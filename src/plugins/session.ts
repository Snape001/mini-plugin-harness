import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Context } from 'cordis'
import type { RuntimeConfig } from '../config.js'
import '../services.js'
import type { ChatMessage, SessionRecord, SessionService, StoredCall, StoredMessage, SummaryCheckpoint, TaskRecord, TaskStatus, ToolCall } from '../types.js'

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
        CREATE TABLE IF NOT EXISTS tool_attempts (call_id TEXT NOT NULL REFERENCES tool_calls(id) ON DELETE CASCADE, attempt INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed','unknown')), started_at TEXT NOT NULL, finished_at TEXT, duration_ms INTEGER, error_code TEXT, error TEXT, approval TEXT, PRIMARY KEY(call_id, attempt));`)
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
        getSummary(sessionId) {
          const row = db.prepare('SELECT from_message_id, through_message_id, content FROM summaries WHERE session_id = ? ORDER BY through_message_id DESC LIMIT 1').get(sessionId) as { from_message_id: number; through_message_id: number; content: string } | undefined
          return row ? { sessionId, fromMessageId: row.from_message_id, throughMessageId: row.through_message_id, content: row.content } satisfies SummaryCheckpoint : undefined
        },
        saveSummary(sessionId, fromMessageId, throughMessageId, content) {
          db.prepare('INSERT INTO summaries(session_id, from_message_id, through_message_id, content) VALUES (?, ?, ?, ?)').run(sessionId, fromMessageId, throughMessageId, content)
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
