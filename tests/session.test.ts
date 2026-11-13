import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '../src/config.js'
import { buildContext } from '../src/context.js'
import { createRuntime } from '../src/runtime.js'
import type { ChatMessage, LlmService } from '../src/types.js'

const dirs: string[] = []
async function tempDir() { const dir = await mkdtemp(path.join(os.tmpdir(), 'miniharness-session-')); dirs.push(dir); return dir }
const configFor = (root: string, extra: Record<string, unknown> = {}) => configSchema.parse({
  projectRoot: root,
  skillsDir: path.join(root, 'skills'),
  sessionDb: path.join(root, '.miniharness', 'sessions.sqlite'),
  plugins: ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'agent'],
  ...extra,
})

afterEach(async () => {
  delete process.env.DEEPSEEK_API_KEY
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('SQLite sessions and recovery', () => {
  it('persists isolated sessions and their ordered task histories across runtime restart', async () => {
    const root = await tempDir()
    const first = await createRuntime(configFor(root))
    const one = first.ctx.session.createSession()
    const two = first.ctx.session.createSession()
    const task = first.ctx.session.startTask(one.id, 'first task')
    first.ctx.session.appendMessage(task.id, { role: 'assistant', content: 'remember this' })
    first.ctx.session.setTaskStatus(task.id, 'completed')
    await first.dispose()

    const next = await createRuntime(configFor(root))
    try {
      expect(next.ctx.session.listMessages(one.id).map((item) => item.message.content)).toEqual(['first task', 'remember this'])
      expect(next.ctx.session.listMessages(two.id)).toEqual([])
      expect(next.ctx.session.listTasks(one.id)[0].status).toBe('completed')
      expect(next.ctx.session.getSession(one.id).id).toBe(one.id)
    } finally { await next.dispose() }
  })

  it('rejects a second runtime trying to own the same database', async () => {
    const root = await tempDir()
    const config = configFor(root, { plugins: ['session'] })
    const first = await createRuntime(config)
    try {
      await expect(createRuntime(config)).rejects.toThrow(/already own/)
    } finally { await first.dispose() }
  })

  it('closes the session database idempotently', async () => {
    const root = await tempDir()
    const runtime = await createRuntime(configFor(root, { plugins: ['session'] }))
    runtime.ctx.session.close()
    expect(() => runtime.ctx.session.close()).not.toThrow()
    await runtime.dispose()
  })

  it('migrates existing task tables and stores segment and tool attempt state', async () => {
    const root = await tempDir()
    const dbPath = path.join(root, '.miniharness', 'sessions.sqlite')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(path.dirname(dbPath), { recursive: true })
    const legacy = new DatabaseSync(dbPath)
    legacy.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
      CREATE TABLE tasks (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','interrupted','completed','failed')), iteration INTEGER NOT NULL DEFAULT 0, skills TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, error TEXT);
      INSERT INTO sessions VALUES ('legacy-session', '2026-01-01T00:00:00.000Z');
      INSERT INTO tasks(id, session_id, prompt, status, iteration, created_at) VALUES ('legacy-task', 'legacy-session', 'old task', 'completed', 2, '2026-01-01T00:00:00.000Z');`)
    legacy.close()

    const runtime = await createRuntime(configFor(root))
    try {
      expect(runtime.ctx.session.getTask('legacy-task').status).toBe('completed')
      const session = runtime.ctx.session.getSession('legacy-session')
      const task = runtime.ctx.session.startTask(session.id, 'new task')
      const call = { id: 'attempt-call', name: 'read_file', arguments: '{"path":"a.txt"}' }
      runtime.ctx.session.recordAssistant(task.id, { role: 'assistant', content: null, tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }] }, [call], 3)
      runtime.ctx.session.startCall(call.id)
      runtime.ctx.session.startAttempt(call.id, 1)
      runtime.ctx.session.finishAttempt(call.id, 1, 'succeeded')
      runtime.ctx.session.finishCall(call.id, 'succeeded', 'ok')
      runtime.ctx.session.setTaskStatus(task.id, 'paused')
      expect(runtime.ctx.session.getTask(task.id).status).toBe('paused')
      expect(runtime.ctx.session.listAttempts(call.id)[0]).toMatchObject({ callId: call.id, attempt: 1, status: 'succeeded', durationMs: expect.any(Number) })
      runtime.ctx.session.setTaskStatus(task.id, 'running')
    } finally { await runtime.dispose() }
  })

  it('keeps cached message lists fresh after writes', async () => {
    const root = await tempDir()
    const runtime = await createRuntime(configFor(root, { plugins: ['session'] }))
    try {
      const session = runtime.ctx.session.createSession()
      const task = runtime.ctx.session.startTask(session.id, 'one')
      expect(runtime.ctx.session.listMessages(session.id).map((item) => item.message.content)).toEqual(['one'])

      const snapshot = runtime.ctx.session.listMessages(session.id)
      snapshot.pop()
      expect(runtime.ctx.session.listMessages(session.id)).toHaveLength(1)

      runtime.ctx.session.appendMessage(task.id, { role: 'assistant', content: 'two' })
      expect(runtime.ctx.session.listMessages(session.id).map((item) => item.message.content)).toEqual(['one', 'two'])

      runtime.ctx.session.setTaskStatus(task.id, 'completed')
      runtime.ctx.session.startTask(session.id, 'three')
      expect(runtime.ctx.session.listMessages(session.id).map((item) => item.message.content)).toEqual(['one', 'two', 'three'])
    } finally { await runtime.dispose() }
  })

  it('carries history within a session and excludes it from another session', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const requests: Array<{ messages: ChatMessage[] }> = []
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as { messages: ChatMessage[] })
      const answer = requests.length === 1 ? 'alpha stored' : requests.length === 2 ? 'beta uses alpha' : 'isolated answer'
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: answer } }] }), { status: 200 })
    }) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    try {
      await (await import('node:fs/promises')).mkdir(path.join(root, 'skills'), { recursive: true })
      const firstSession = runtime.ctx.session.createSession()
      const secondSession = runtime.ctx.session.createSession()
      await runtime.ctx.agent.run('remember alpha', firstSession.id)
      await runtime.ctx.agent.run('use the earlier fact', firstSession.id)
      await runtime.ctx.agent.run('unrelated task', secondSession.id)
      const sameSessionHistory = requests[1].messages.map((message) => message.content ?? '').join('\n')
      const otherSessionHistory = requests[2].messages.map((message) => message.content ?? '').join('\n')
      expect(sameSessionHistory).toContain('remember alpha')
      expect(sameSessionHistory).toContain('alpha stored')
      expect(otherSessionHistory).not.toContain('remember alpha')
      expect(otherSessionHistory).not.toContain('alpha stored')
    } finally { await runtime.dispose() }
  })

  it('summarizes old task ranges and preserves complete recent tool call messages', async () => {
    const root = await tempDir()
    const config = configFor(root, { contextInputTokens: 2048, contextOutputReserve: 128 })
    const runtime = await createRuntime(config)
    try {
      const session = runtime.ctx.session.createSession()
      for (let index = 0; index < 8; index++) {
        const task = runtime.ctx.session.startTask(session.id, `task-${index} ${'detail '.repeat(80)}`)
        runtime.ctx.session.setTaskSkills(task.id, [])
        if (index === 7) {
          const call = { id: 'recent-call', name: 'read_file', arguments: '{"path":"sample.txt"}' }
          runtime.ctx.session.recordAssistant(task.id, {
            role: 'assistant', content: null,
            tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }],
          }, [call], 1)
          runtime.ctx.session.startCall(call.id)
          runtime.ctx.session.finishCall(call.id, 'succeeded', 'recent tool result')
        } else {
          runtime.ctx.session.appendMessage(task.id, { role: 'assistant', content: `answer-${index}` })
        }
        runtime.ctx.session.setTaskStatus(task.id, 'completed')
      }
      const fakeLlm = { summarize: vi.fn(async () => 'Summary covering the four earlier tasks.') } as unknown as LlmService
      const context = await buildContext(config, runtime.ctx.session, fakeLlm, session.id, [], [])
      expect(fakeLlm.summarize).toHaveBeenCalled()
      expect(runtime.ctx.session.getSummary(session.id)?.content).toContain('four earlier tasks')
      expect(runtime.ctx.session.getSummary(session.id)?.fromMessageId).toBeLessThan(runtime.ctx.session.getSummary(session.id)!.throughMessageId)
      expect(context.some((message) => message.content?.includes('Summary of earlier conversation'))).toBe(true)
      const assistant = context.find((message) => message.role === 'assistant' && message.tool_calls?.some((call) => call.id === 'recent-call'))
      expect(assistant?.tool_calls?.[0].id).toBe('recent-call')
      expect(context.some((message) => message.role === 'tool' && message.tool_call_id === 'recent-call')).toBe(true)
      expect(context.some((message) => message.content?.includes('task-0'))).toBe(false)
      expect(context.some((message) => message.content?.includes('task-7'))).toBe(true)
    } finally { await runtime.dispose() }
  })

  it.each(['before tool execution', 'during tool execution', 'after side effect before result commit'])('recovers safely from a simulated crash %s', async (faultPoint) => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const config = configFor(root)
    const first = await createRuntime(config)
    const session = first.ctx.session.createSession()
    const task = first.ctx.session.startTask(session.id, `fault at ${faultPoint}`)
    first.ctx.session.setTaskSkills(task.id, [])
    const assistant: ChatMessage = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: `call-${faultPoint}`, type: 'function', function: { name: 'write_file', arguments: '{"path":"side-effect.txt","content":"done"}' } }],
    }
    first.ctx.session.recordAssistant(task.id, assistant, [{ id: `call-${faultPoint}`, name: 'write_file', arguments: '{"path":"side-effect.txt","content":"done"}' }], 1)
    if (faultPoint !== 'before tool execution') first.ctx.session.startCall(`call-${faultPoint}`)
    if (faultPoint === 'after side effect before result commit') await writeFile(path.join(root, 'side-effect.txt'), 'done')
    await first.dispose()

    const fakeFetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Recovered without replaying the tool.' } }] }), { status: 200 })) as typeof fetch
    const resumed = await createRuntime(config, fakeFetch)
    try {
      expect(resumed.ctx.session.getTask(task.id).status).toBe('interrupted')
      const execute = vi.spyOn(resumed.ctx.tools, 'execute')
      expect(await resumed.ctx.agent.resume(task.id)).toContain('without replaying')
      expect(execute).not.toHaveBeenCalled()
      expect(resumed.ctx.session.listCalls(task.id)[0].status).toBe('unknown')
      expect(resumed.ctx.session.listMessages(session.id).some((item) => item.message.role === 'tool' && item.message.tool_call_id === `call-${faultPoint}` && String(item.message.content).includes('unknown'))).toBe(true)
      expect(fakeFetch).toHaveBeenCalledTimes(1)
      expect(resumed.ctx.session.getTask(task.id).status).toBe('completed')
      if (faultPoint === 'after side effect before result commit') expect(await import('node:fs/promises').then(({ readFile }) => readFile(path.join(root, 'side-effect.txt'), 'utf8'))).toBe('done')
    } finally { await resumed.dispose() }
  })
})
