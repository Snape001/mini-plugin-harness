import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'

const dirs: string[] = []
async function tempDir() { const dir = await mkdtemp(path.join(os.tmpdir(), 'miniharness-agent-')); dirs.push(dir); return dir }
const configFor = (root: string, extra: Record<string, unknown> = {}) => configSchema.parse({ projectRoot: root, skillsDir: path.join(root, 'skills'), sessionDb: path.join(root, '.miniharness', 'sessions.sqlite'), maxIterations: 4, toolRetries: 1, plugins: ['logger', 'hooks', 'llm', 'tools', 'skills', 'permission', 'session', 'agent'], ...extra })

afterEach(async () => { delete process.env.DEEPSEEK_API_KEY; await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

describe('Agent loop and DeepSeek adapter', () => {
  it('runs multiple tool rounds and then returns the final answer', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    await mkdir(path.join(root, 'skills', 'repo-analysis'), { recursive: true })
    await writeFile(path.join(root, 'skills', 'repo-analysis', 'SKILL.md'), '---\nname: repo-analysis\ndescription: Analyze repository structure.\n---\nUse a structured repository analysis workflow.')
    const replies = [
      { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"skills":["repo-analysis"]}' } }] },
      { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: '1', type: 'function', function: { name: 'list_files', arguments: '{}' } }] } }] },
      { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: '2', type: 'function', function: { name: 'search_text', arguments: '{"query":"agent"}' } }] } }] },
      { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'The Agent coordinates the loop.' } }] },
    ]
    const requests: Array<Record<string, unknown>> = []
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-secret')
      requests.push(JSON.parse(String(init?.body)))
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'deepseek-flash', thinking: { type: 'disabled' } })
      return new Response(JSON.stringify(replies.shift()), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    try {
      const events: string[] = []
      const result = await runtime.ctx.agent.run('Analyze the project', (event) => events.push(event.type))
      expect(result).toContain('coordinates the loop')
      expect(requests).toHaveLength(4)
      expect(requests[0]).toMatchObject({ response_format: { type: 'json_object' } })
      const firstAgentMessages = requests[1].messages as Array<{ role: string; content?: string }>
      expect(firstAgentMessages.filter((message) => message.role === 'user')).toHaveLength(2)
      expect(firstAgentMessages[1].content).toContain('structured repository analysis workflow')
      expect((requests[2].messages as unknown[]).length).toBeGreaterThan(4)
      expect(events.filter((event) => event === 'tool.start')).toHaveLength(2)
      expect(events).toContain('skills.loaded')
      expect(events.at(-1)).toBe('agent.final')
    } finally { await runtime.dispose() }
  })

  it('feeds invalid JSON and tool errors back, retries finitely, and stops at the loop guard', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    let requestNo = 0
    const fakeFetch = vi.fn(async () => {
      requestNo++
      const message = requestNo === 1
        ? { role: 'assistant', content: null, tool_calls: [{ id: 'bad', type: 'function', function: { name: 'read_file', arguments: '{' } }] }
        : { role: 'assistant', content: null, tool_calls: [{ id: `call-${requestNo}`, type: 'function', function: { name: 'read_file', arguments: '{"path":"missing.txt"}' } }] }
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message }] }), { status: 200 })
    }) as typeof fetch
    const runtime = await createRuntime(configFor(root, { maxIterations: 2, maxTaskIterations: 2 }), fakeFetch)
    try { await expect(runtime.ctx.agent.run('keep reading')).rejects.toThrow(/maximum total of 2/); expect(fakeFetch).toHaveBeenCalledTimes(2) }
    finally { await runtime.dispose() }
  })

  it('pauses at the per-run iteration boundary, persists traces, and resumes in the same task', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const replies = [
      { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'segment-call', type: 'function', function: { name: 'list_files', arguments: '{}' } }] } }] },
      { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Finished after resume.' } }] },
    ]
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify(replies.shift()), { status: 200 })) as typeof fetch
    const runtime = await createRuntime(configFor(root, { maxIterations: 1, maxTaskIterations: 3 }), fakeFetch)
    try {
      const session = runtime.ctx.session.createSession()
      await expect(runtime.ctx.agent.run('continue this task', session.id)).rejects.toThrow(/paused after 1 iterations/)
      const task = runtime.ctx.session.listTasks(session.id)[0]
      expect(task.status).toBe('paused')
      expect(task.iteration).toBe(1)
      expect(runtime.ctx.session.listAttempts('segment-call')).toMatchObject([{ attempt: 1, status: 'succeeded' }])
      await expect(runtime.ctx.agent.resume(task.id)).resolves.toBe('Finished after resume.')
      expect(runtime.ctx.session.getTask(task.id).status).toBe('completed')
      expect(runtime.ctx.session.getTask(task.id).iteration).toBe(2)
    } finally { await runtime.dispose() }
  })

  it('fails a resumed task at its persisted total iteration limit', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    let requestNo = 0
    const fakeFetch = vi.fn(async () => {
      requestNo++
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: `call-${requestNo}`, type: 'function', function: { name: 'list_files', arguments: '{}' } }] } }] }), { status: 200 })
    }) as typeof fetch
    const runtime = await createRuntime(configFor(root, { maxIterations: 1, maxTaskIterations: 2 }), fakeFetch)
    try {
      const session = runtime.ctx.session.createSession()
      await expect(runtime.ctx.agent.run('keep working', session.id)).rejects.toThrow(/paused/)
      const taskId = runtime.ctx.session.listTasks(session.id)[0].id
      await expect(runtime.ctx.agent.resume(taskId)).rejects.toThrow(/maximum total of 2/)
      expect(runtime.ctx.session.getTask(taskId).status).toBe('failed')
      expect(fakeFetch).toHaveBeenCalledTimes(2)
    } finally { await runtime.dispose() }
  })

  it('propagates cancellation to DeepSeek and leaves the task recoverable', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const fakeFetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBeDefined()
      return new Promise<Response>(() => {})
    }) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    try {
      const session = runtime.ctx.session.createSession()
      const controller = new AbortController()
      const pending = runtime.ctx.agent.run('stop me', session.id, undefined, controller.signal)
      await vi.waitFor(() => expect(fakeFetch).toHaveBeenCalledOnce())
      controller.abort(new Error('test interrupt'))
      await expect(pending).rejects.toThrow(/test interrupt/)
      expect(runtime.ctx.session.listTasks(session.id)[0].status).toBe('interrupted')
    } finally { await runtime.dispose() }
  })

  it('does not retry a dangerous call after the user rejects approval', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const bodies: Array<Record<string, unknown>> = []
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      bodies.push(body)
      const message = bodies.length === 1
        ? { role: 'assistant', content: null, tool_calls: [{ id: 'danger-1', type: 'function', function: { name: 'run_shell', arguments: '{"command":"echo no"}' } }] }
        : { role: 'assistant', content: 'The command was not approved.' }
      return new Response(JSON.stringify({ choices: [{ finish_reason: bodies.length === 1 ? 'tool_calls' : 'stop', message }] }), { status: 200 })
    }) as typeof fetch
    const approve = vi.fn(async () => false)
    const runtime = await createRuntime(configFor(root, { toolRetries: 3 }), fakeFetch, approve)
    try {
      const session = runtime.ctx.session.createSession()
      const answer = await runtime.ctx.agent.run('Run a shell command', session.id)
      expect(answer).toContain('not approved')
      expect(approve).toHaveBeenCalledOnce()
      expect(bodies).toHaveLength(2)
      expect(JSON.stringify(bodies[1])).toContain('[APPROVAL_REJECTED]')
      expect(runtime.ctx.session.listAttempts('danger-1')).toMatchObject([{ status: 'failed', approval: 'rejected', errorCode: 'APPROVAL_REJECTED' }])
    } finally { await runtime.dispose() }
  })

  it('retries read-only MCP-style error results and records each failed attempt', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    let requests = 0
    const fakeFetch = vi.fn(async () => {
      requests++
      const message = requests === 1
        ? { role: 'assistant', content: null, tool_calls: [{ id: 'reported-error', type: 'function', function: { name: 'reported_error', arguments: '{}' } }] }
        : { role: 'assistant', content: 'Recovered.' }
      return new Response(JSON.stringify({ choices: [{ finish_reason: requests === 1 ? 'tool_calls' : 'stop', message }] }), { status: 200 })
    }) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    runtime.ctx.tools.replaceSource('eval', [{
      definition: { name: 'reported_error', description: 'Returns a tool error result.', permission: 'read', parameters: { type: 'object' } },
      validate: () => ({}),
      execute: () => ({ content: [{ type: 'text', text: 'temporary MCP failure' }], isError: true }),
    }])
    try {
      const session = runtime.ctx.session.createSession()
      await expect(runtime.ctx.agent.run('retry the read-only error', session.id)).resolves.toBe('Recovered.')
      expect(runtime.ctx.session.listAttempts('reported-error')).toMatchObject([
        { attempt: 1, status: 'failed', errorCode: 'TOOL_REPORTED_ERROR' },
        { attempt: 2, status: 'failed', errorCode: 'TOOL_REPORTED_ERROR' },
      ])
    } finally { await runtime.dispose() }
  })

  it('surfaces DeepSeek HTTP failures without leaking the API key', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const fakeFetch = vi.fn(async () => new Response('upstream unavailable', { status: 503 })) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    try {
      await expect(runtime.ctx.agent.run('Analyze')).rejects.toThrow('DeepSeek API 503: upstream unavailable')
    } finally { await runtime.dispose() }
  })

  it('fails an empty final response instead of reporting completion', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: null } }],
    }), { status: 200 })) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    try {
      const session = runtime.ctx.session.createSession()
      await expect(runtime.ctx.agent.run('empty answer', session.id)).rejects.toThrow(/empty final response/)
      expect(runtime.ctx.session.listTasks(session.id)[0].status).toBe('failed')
    } finally { await runtime.dispose() }
  })

  it('fails a response truncated by the output limit', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: 'length', message: { role: 'assistant', content: null } }],
    }), { status: 200 })) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    try {
      const session = runtime.ctx.session.createSession()
      await expect(runtime.ctx.agent.run('truncated answer', session.id)).rejects.toThrow(/finish_reason=length/)
      expect(runtime.ctx.session.listTasks(session.id)[0].status).toBe('failed')
    } finally { await runtime.dispose() }
  })

  it('times out a hanging DeepSeek request', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const fakeFetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })) as typeof fetch
    const runtime = await createRuntime(configFor(root, { requestTimeoutMs: 1_000 }), fakeFetch)
    try {
      await expect(runtime.ctx.llm.complete([], [])).rejects.toThrow(/timed out after 1000 ms/)
    } finally { await runtime.dispose() }
  })

  it('cleans up runtime services and rejects invalid plugin dependencies', async () => {
    const root = await tempDir()
    await expect(createRuntime(configFor(root, { plugins: ['agent'] }))).rejects.toThrow(/requires "llm"/)
    await expect(createRuntime(configFor(root, { plugins: ['agent', 'tools', 'llm', 'hooks'] }))).rejects.toThrow(/requires "skills"/)
    const runtime = await createRuntime(configFor(root, { plugins: ['agent', 'tools', 'llm', 'hooks', 'logger', 'skills', 'permission', 'session'] }))
    expect(runtime.ctx.get('agent')).toBeDefined()
    await runtime.dispose()
    expect(runtime.ctx.get('agent')).toBeUndefined()
  })
})
