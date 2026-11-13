import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Context } from 'cordis'
import type { RuntimeConfig } from '../config.js'
import '../services.js'
import type { ChatMessage, ContextCheckpoint, PromptTrace, SessionRecord, SessionService, SkillTrace, StoredCall, StoredMessage, SummaryCheckpoint, TaskRecord, TaskStatus, ToolCall } from '../types.js'

const now = () => new Date().toISOString()

function isDuplicateColumn(error: unknown) {
  return /duplicate column name/i.test((error as Error).message)
}

export function createSessionPlugin(config: RuntimeConfig) {
  return {
    name: 'session',
    apply(ctx: Context) {
      mkdirSync(path.dirname(config.sessionDb), { recursive: true })
      const db = new DatabaseSync(config.sessionDb)
      let closed = false
      const messageCache = new Map<string, StoredMessage[]>()
      function cloneStored(entry: StoredMessage): StoredMessage {
        return {
          ...entry,
          message: {
            ...entry.message,
            ...(entry.message.tool_calls
              ? { tool_calls: entry.message.tool_calls.map((call) => ({ ...call, function: { ...call.function } })) }
              : {}),
          },
        }
      }
      try {
      db.exec(`PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 1000;
        PRAGMA locking_mode = EXCLUSIVE;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = FULL;
        CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), prompt TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','paused','interrupted','completed','failed')), iteration INTEGER NOT NULL DEFAULT 0, skills TEXT NOT NULL DEFAULT '[]', skills_selected INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, error TEXT);
        CREATE INDEX IF NOT EXISTS tasks_session ON tasks(session_id, created_at);
        CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(id), body TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS messages_task ON messages(task_id, id);
        CREATE TABLE IF NOT EXISTS tool_calls (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), name TEXT NOT NULL, arguments TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','running','succeeded','failed','unknown')), result TEXT);
        CREATE TABLE IF NOT EXISTS summaries (session_id TEXT NOT NULL REFERENCES sessions(id), from_message_id INTEGER NOT NULL DEFAULT 0, through_message_id INTEGER NOT NULL, content TEXT NOT NULL, PRIMARY KEY(session_id, through_message_id));
        CREATE TABLE IF NOT EXISTS task_summaries (task_id TEXT NOT NULL REFERENCES tasks(id), from_message_id INTEGER NOT NULL, through_message_id INTEGER NOT NULL, content TEXT NOT NULL, PRIMARY KEY(task_id, through_message_id));
        CREATE TABLE IF NOT EXISTS context_checkpoints (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), task_id TEXT REFERENCES tasks(id), level TEXT NOT NULL CHECK(level IN ('L1','L2','L3')), from_message_id INTEGER NOT NULL, through_message_id INTEGER NOT NULL, content TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS context_checkpoints_scope ON context_checkpoints(session_id, task_id, from_message_id);
        CREATE TABLE IF NOT EXISTS tool_attempts (call_id TEXT NOT NULL REFERENCES tool_calls(id) ON DELETE CASCADE, attempt INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed','unknown')), started_at TEXT NOT NULL, finished_at TEXT, duration_ms INTEGER, error_code TEXT, error TEXT, approval TEXT, PRIMARY KEY(call_id, attempt));
        CREATE TABLE IF NOT EXISTS prompt_snapshots (task_id TEXT PRIMARY KEY REFERENCES tasks(id), body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS prompt_traces (task_id TEXT NOT NULL REFERENCES tasks(id), iteration INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(task_id, iteration));`)
      db.exec('CREATE TABLE IF NOT EXISTS skill_traces (task_id TEXT PRIMARY KEY REFERENCES tasks(id), body TEXT NOT NULL)')
      try { db.exec('ALTER TABLE tasks ADD COLUMN skills_selected INTEGER NOT NULL DEFAULT 0') } catch (error) { if (!isDuplicateColumn(error)) throw error }
      const taskSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").get() as { sql: string } | undefined)?.sql ?? ''
      if (!taskSql.includes("'paused'")) {
        db.exec(`PRAGMA foreign_keys = OFF;
          BEGIN IMMEDIATE;
          CREATE TABLE tasks_next (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), prompt TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','paused','interrupted','completed','failed')), iteration INTEGER NOT NULL DEFAULT 0, skills TEXT NOT NULL DEFAULT '[]', skills_selected INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, error TEXT);
          INSERT INTO tasks_next SELECT id, session_id, prompt, status, iteration, skills, skills_selected, created_at, error FROM tasks;
          DROP TABLE tasks;
          ALTER TABLE tasks_next RENAME TO tasks;
          CREATE INDEX IF NOT EXISTS tasks_session ON tasks(session_id, created_at);
          COMMIT;
          PRAGMA foreign_keys = ON;`)
      }
      // One runtime owns this database at a time. A previous running task was interrupted.
        try { db.exec('ALTER TABLE summaries ADD COLUMN from_message_id INTEGER NOT NULL DEFAULT 0') } catch (error) { if (!isDuplicateColumn(error)) throw error }
        db.prepare("UPDATE tasks SET status = 'interrupted' WHERE status = 'running'").run()

      function transaction<T>(fn: () => T): T {
        db.exec('BEGIN IMMEDIATE')
        try { const result = fn(); db.exec('COMMIT'); return result }
        catch (error) { db.exec('ROLLBACK'); messageCache.clear(); throw error }
      }
      function taskRow(id: string): TaskRecord {
        const row = db.prepare('SELECT id, session_id, prompt, status, iteration, skills, skills_selected, created_at, error FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
        if (!row) throw new Error(`Unknown task: ${id}`)
        return { id: String(row.id), sessionId: String(row.session_id), prompt: String(row.prompt), status: row.status as TaskStatus, iteration: Number(row.iteration), skills: JSON.parse(String(row.skills)) as string[], skillsSelected: Boolean(row.skills_selected), createdAt: String(row.created_at), error: row.error === null ? null : String(row.error) }
      }
      function sessionRow(id: string): SessionRecord {
        const row = db.prepare('SELECT id, created_at FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined
        if (!row) throw new Error(`Unknown session: ${id}`)
        return { id: String(row.id), createdAt: String(row.created_at) }
      }
      function insertMessage(taskId: string, message: ChatMessage): number {
        const result = db.prepare('INSERT INTO messages(task_id, body) VALUES (?, ?)').run(taskId, JSON.stringify(message))
        const id = Number(result.lastInsertRowid)
        const sessionId = taskRow(taskId).sessionId
        const cached = messageCache.get(sessionId)
        if (cached) cached.push(cloneStored({ id, taskId, message }))
        return id
      }
      const service: SessionService = {
        createSession() {
          const session = { id: randomUUID(), createdAt: now() }
          db.prepare('INSERT INTO sessions(id, created_at) VALUES (?, ?)').run(session.id, session.createdAt)
          return session
        },
        getSession: sessionRow,
        listSessions() {
          return (db.prepare('SELECT id, created_at FROM sessions ORDER BY created_at DESC').all() as Array<Record<string, unknown>>)
            .map((row) => ({ id: String(row.id), createdAt: String(row.created_at) }))
        },
        listTasks(sessionId) {
          sessionRow(sessionId)
          return (db.prepare('SELECT id FROM tasks WHERE session_id = ? ORDER BY created_at DESC').all(sessionId) as Array<{ id: string }>).map((row) => taskRow(row.id))
        },
        getTask: taskRow,
        startTask(sessionId, prompt) {
          sessionRow(sessionId)
          return transaction(() => {
            const active = db.prepare("SELECT id FROM tasks WHERE session_id = ? AND status IN ('running','paused','interrupted') LIMIT 1").get(sessionId)
            if (active) throw new Error('Session has an unfinished task; use :resume or another session')
            const id = randomUUID()
            db.prepare('INSERT INTO tasks(id, session_id, prompt, status, created_at) VALUES (?, ?, ?, ?, ?)').run(id, sessionId, prompt, 'running', now())
            insertMessage(id, { role: 'user', content: prompt })
            return taskRow(id)
          })
        },
        setTaskSkills(id, skills) { db.prepare('UPDATE tasks SET skills = ?, skills_selected = 1 WHERE id = ?').run(JSON.stringify(skills), id) },
        saveSkillTrace(trace) {
          taskRow(trace.taskId)
          db.prepare('INSERT INTO skill_traces(task_id, body) VALUES (?, ?) ON CONFLICT(task_id) DO UPDATE SET body = excluded.body').run(trace.taskId, JSON.stringify(trace))
        },
        getSkillTrace(taskId) {
          taskRow(taskId)
          const row = db.prepare('SELECT body FROM skill_traces WHERE task_id = ?').get(taskId) as { body: string } | undefined
          return row ? JSON.parse(row.body) as SkillTrace : undefined
        },
        setTaskStatus(id, status, error) {
          const old = taskRow(id).status
          const valid = (old === 'running' && ['paused', 'interrupted', 'completed', 'failed'].includes(status)) || (['paused', 'interrupted'].includes(old) && status === 'running')
          if (!valid) throw new Error(`Invalid task transition: ${old} -> ${status}`)
          db.prepare('UPDATE tasks SET status = ?, error = ? WHERE id = ?').run(status, error ?? null, id)
        },
        appendMessage: insertMessage,
        recordAssistant(taskId, message, calls, iteration) {
          transaction(() => {
            insertMessage(taskId, message)
            for (const call of calls) db.prepare('INSERT INTO tool_calls(id, task_id, name, arguments, status) VALUES (?, ?, ?, ?, ?)').run(call.id, taskId, call.name, call.arguments, 'pending')
            db.prepare('UPDATE tasks SET iteration = ? WHERE id = ? AND status = ?').run(iteration, taskId, 'running')
          })
        },
        listMessages(sessionId) {
          const cached = messageCache.get(sessionId)
          if (cached) return cached.map(cloneStored)
          sessionRow(sessionId)
          const messages = (db.prepare('SELECT m.id, m.task_id, m.body FROM messages m JOIN tasks t ON t.id = m.task_id WHERE t.session_id = ? ORDER BY m.id').all(sessionId) as Array<Record<string, unknown>>)
            .map((row): StoredMessage => ({ id: Number(row.id), taskId: String(row.task_id), message: JSON.parse(String(row.body)) as ChatMessage }))
          messageCache.set(sessionId, messages)
          return messages.map(cloneStored)
        },
        listMessagesSince(sessionId, afterMessageId, taskId) {
          sessionRow(sessionId)
          if (taskId && taskRow(taskId).sessionId !== sessionId) throw new Error(`Task ${taskId} is not in session ${sessionId}`)
          const rows = taskId
            ? db.prepare('SELECT id, task_id, body FROM messages WHERE task_id = ? AND id > ? ORDER BY id').all(taskId, afterMessageId)
            : db.prepare('SELECT m.id, m.task_id, m.body FROM messages m JOIN tasks t ON t.id = m.task_id WHERE t.session_id = ? AND m.id > ? ORDER BY m.id').all(sessionId, afterMessageId)
          return (rows as Array<{ id: number; task_id: string; body: string }>).map((row) => ({ id: row.id, taskId: row.task_id, message: JSON.parse(row.body) as ChatMessage }))
        },
        getLastMessage(taskId) {
          taskRow(taskId)
          const row = db.prepare('SELECT id, task_id, body FROM messages WHERE task_id = ? ORDER BY id DESC LIMIT 1').get(taskId) as { id: number; task_id: string; body: string } | undefined
          return row ? { id: row.id, taskId: row.task_id, message: JSON.parse(row.body) as ChatMessage } : undefined
        },
        startCall(id) {
          const result = db.prepare("UPDATE tool_calls SET status = 'running' WHERE id = ? AND status = 'pending'").run(id)
          if (!result.changes) throw new Error(`Tool call is not pending: ${id}`)
        },
        finishCall(id, status, content) {
          transaction(() => {
            const row = db.prepare('SELECT task_id, status FROM tool_calls WHERE id = ?').get(id) as { task_id: string; status: string } | undefined
            if (!row || !['pending', 'running'].includes(row.status)) throw new Error(`Tool call cannot finish: ${id}`)
            db.prepare('UPDATE tool_calls SET status = ?, result = ? WHERE id = ?').run(status, content, id)
            insertMessage(row.task_id, { role: 'tool', tool_call_id: id, content })
          })
        },
        startAttempt(callId, attempt) {
          db.prepare('INSERT INTO tool_attempts(call_id, attempt, status, started_at) VALUES (?, ?, ?, ?)').run(callId, attempt, 'running', now())
        },
        finishAttempt(callId, attempt, status, details = {}) {
          const row = db.prepare('SELECT started_at FROM tool_attempts WHERE call_id = ? AND attempt = ?').get(callId, attempt) as { started_at: string } | undefined
          if (!row) throw new Error(`Unknown tool attempt: ${callId}/${attempt}`)
          const finishedAt = now()
          const duration = Math.max(0, Date.parse(finishedAt) - Date.parse(row.started_at))
          db.prepare('UPDATE tool_attempts SET status = ?, finished_at = ?, duration_ms = ?, error_code = ?, error = ?, approval = ? WHERE call_id = ? AND attempt = ?')
            .run(status, finishedAt, duration, details.errorCode ?? null, details.error ?? null, details.approval ?? null, callId, attempt)
        },
        listAttempts(callId) {
          return (db.prepare('SELECT call_id, attempt, status, started_at, finished_at, duration_ms, error_code, error, approval FROM tool_attempts WHERE call_id = ? ORDER BY attempt').all(callId) as Array<Record<string, unknown>>)
            .map((row) => ({ callId: String(row.call_id), attempt: Number(row.attempt), status: row.status as import('../types.js').ToolAttemptStatus, startedAt: String(row.started_at), finishedAt: row.finished_at === null ? null : String(row.finished_at), durationMs: row.duration_ms === null ? null : Number(row.duration_ms), errorCode: row.error_code === null ? null : String(row.error_code), error: row.error === null ? null : String(row.error), approval: row.approval === null ? null : String(row.approval) }))
        },
        listCalls(taskId) {
          return (db.prepare('SELECT id, task_id, name, arguments, status, result FROM tool_calls WHERE task_id = ? ORDER BY rowid').all(taskId) as Array<Record<string, unknown>>)
            .map((row): StoredCall => ({ id: String(row.id), taskId: String(row.task_id), name: String(row.name), arguments: String(row.arguments), status: row.status as StoredCall['status'], result: row.result === null ? null : String(row.result) }))
        },
        reconcileCalls(taskId) {
          for (const call of service.listCalls(taskId).filter((item) => item.status === 'pending' || item.status === 'running')) {
            for (const attempt of service.listAttempts(call.id).filter((item) => item.status === 'running')) {
              service.finishAttempt(call.id, attempt.attempt, 'unknown', { errorCode: 'UNKNOWN_AFTER_INTERRUPT', error: 'Tool execution status is unknown after interruption' })
            }
            service.finishCall(call.id, 'unknown', 'Error: Tool execution status is unknown after interruption. The tool was not retried; inspect the current state before further action.')
          }
        },
        getSummary(sessionId, taskId) {
          if (taskId && taskRow(taskId).sessionId !== sessionId) throw new Error(`Task ${taskId} is not in session ${sessionId}`)
          const row = (taskId
            ? db.prepare('SELECT from_message_id, through_message_id, content FROM task_summaries WHERE task_id = ? ORDER BY through_message_id DESC LIMIT 1').get(taskId)
            : db.prepare('SELECT from_message_id, through_message_id, content FROM summaries WHERE session_id = ? ORDER BY through_message_id DESC LIMIT 1').get(sessionId)) as { from_message_id: number; through_message_id: number; content: string } | undefined
          return row ? { sessionId, fromMessageId: row.from_message_id, throughMessageId: row.through_message_id, content: row.content } satisfies SummaryCheckpoint : undefined
        },
        saveSummary(sessionId, fromMessageId, throughMessageId, content, taskId) {
          if (taskId) {
            if (taskRow(taskId).sessionId !== sessionId) throw new Error(`Task ${taskId} is not in session ${sessionId}`)
            db.prepare('INSERT INTO task_summaries(task_id, from_message_id, through_message_id, content) VALUES (?, ?, ?, ?) ON CONFLICT(task_id, through_message_id) DO UPDATE SET from_message_id = excluded.from_message_id, content = excluded.content').run(taskId, fromMessageId, throughMessageId, content)
          } else db.prepare('INSERT INTO summaries(session_id, from_message_id, through_message_id, content) VALUES (?, ?, ?, ?) ON CONFLICT(session_id, through_message_id) DO UPDATE SET from_message_id = excluded.from_message_id, content = excluded.content').run(sessionId, fromMessageId, throughMessageId, content)
        },
        listContextCheckpoints(sessionId, taskId) {
          sessionRow(sessionId)
          if (taskId && taskRow(taskId).sessionId !== sessionId) throw new Error(`Task ${taskId} is not in session ${sessionId}`)
          const rows = db.prepare('SELECT id, session_id, task_id, level, from_message_id, through_message_id, content FROM context_checkpoints WHERE session_id = ? AND task_id IS ? ORDER BY from_message_id, id').all(sessionId, taskId ?? null) as Array<Record<string, unknown>>
          return rows.map((row): ContextCheckpoint => ({ id: Number(row.id), sessionId: String(row.session_id), ...(row.task_id === null ? {} : { taskId: String(row.task_id) }), level: row.level as ContextCheckpoint['level'], fromMessageId: Number(row.from_message_id), throughMessageId: Number(row.through_message_id), content: String(row.content) }))
        },
        replaceContextCheckpoints(sessionId, removedIds, checkpoint, taskId) {
          sessionRow(sessionId)
          if (taskId && taskRow(taskId).sessionId !== sessionId) throw new Error(`Task ${taskId} is not in session ${sessionId}`)
          if (checkpoint.sessionId !== sessionId || (checkpoint.taskId ?? undefined) !== taskId || checkpoint.fromMessageId > checkpoint.throughMessageId) throw new Error('Invalid context checkpoint scope or range')
          transaction(() => {
            for (const id of removedIds) {
              const result = db.prepare('DELETE FROM context_checkpoints WHERE id = ? AND session_id = ? AND task_id IS ?').run(id, sessionId, taskId ?? null)
              if (!result.changes) throw new Error(`Unknown context checkpoint: ${id}`)
            }
            const overlap = db.prepare('SELECT id FROM context_checkpoints WHERE session_id = ? AND task_id IS ? AND from_message_id <= ? AND through_message_id >= ? LIMIT 1').get(sessionId, taskId ?? null, checkpoint.throughMessageId, checkpoint.fromMessageId)
            if (overlap) throw new Error('Overlapping context checkpoint')
            db.prepare('INSERT INTO context_checkpoints(session_id, task_id, level, from_message_id, through_message_id, content) VALUES (?, ?, ?, ?, ?, ?)').run(sessionId, taskId ?? null, checkpoint.level, checkpoint.fromMessageId, checkpoint.throughMessageId, checkpoint.content)
          })
        },
        listMessagesRange(sessionId, fromMessageId, throughMessageId, taskId) {
          sessionRow(sessionId)
          if (taskId && taskRow(taskId).sessionId !== sessionId) throw new Error(`Task ${taskId} is not in session ${sessionId}`)
          const rows = db.prepare(`SELECT m.id, m.task_id, m.body FROM messages m JOIN tasks t ON t.id = m.task_id WHERE t.session_id = ? AND m.id BETWEEN ? AND ? ${taskId ? 'AND m.task_id = ?' : ''} ORDER BY m.id`).all(...(taskId ? [sessionId, fromMessageId, throughMessageId, taskId] : [sessionId, fromMessageId, throughMessageId])) as Array<{ id: number; task_id: string; body: string }>
          return rows.map((row) => ({ id: row.id, taskId: row.task_id, message: JSON.parse(row.body) as ChatMessage }))
        },
        getPromptSnapshot(taskId) {
          const row = db.prepare('SELECT body FROM prompt_snapshots WHERE task_id = ?').get(taskId) as { body: string } | undefined
          return row ? JSON.parse(row.body) : undefined
        },
        savePromptSnapshot(taskId, snapshot) {
          db.prepare('INSERT INTO prompt_snapshots(task_id, body) VALUES (?, ?)').run(taskId, JSON.stringify(snapshot))
        },
        startPromptTrace(trace) {
          db.prepare('INSERT INTO prompt_traces(task_id, iteration, body) VALUES (?, ?, ?) ON CONFLICT(task_id, iteration) DO UPDATE SET body = excluded.body').run(trace.taskId, trace.iteration, JSON.stringify(trace))
        },
        finishPromptTrace(taskId, iteration, status, usage, error) {
          const row = db.prepare('SELECT body FROM prompt_traces WHERE task_id = ? AND iteration = ?').get(taskId, iteration) as { body: string } | undefined
          if (!row) throw new Error(`Unknown Prompt trace: ${taskId}/${iteration}`)
          const trace = JSON.parse(row.body) as PromptTrace
          Object.assign(trace, { status, inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null, totalTokens: usage?.totalTokens ?? null, error: error ?? null })
          db.prepare('UPDATE prompt_traces SET body = ? WHERE task_id = ? AND iteration = ?').run(JSON.stringify(trace), taskId, iteration)
        },
        listPromptTraces(taskId) {
          taskRow(taskId)
          return (db.prepare('SELECT body FROM prompt_traces WHERE task_id = ? ORDER BY iteration').all(taskId) as Array<{ body: string }>).map((row) => JSON.parse(row.body) as PromptTrace)
        },
        close() {
          if (closed) return
          closed = true
          db.close()
        },
      }
      ctx.set('session', service)
      } catch (error) {
        db.close()
        throw error
      }
    },
  }
}
