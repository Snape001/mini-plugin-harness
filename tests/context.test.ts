import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '../src/config.js'
import { allocateLayerBudgets, buildContext, estimateTokens } from '../src/context.js'
import { createRuntime } from '../src/runtime.js'
import type { ChatMessage, LlmService } from '../src/types.js'

const dirs: string[] = []
async function fixture(extra: Record<string, unknown> = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'miniharness-context-'))
  dirs.push(root)
  const config = configSchema.parse({
    projectRoot: root, sessionDb: path.join(root, 'sessions.sqlite'), plugins: ['session'],
    contextInputTokens: 2048, contextOutputReserve: 128, ...extra,
  })
  return { config, runtime: await createRuntime(config) }
}
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const llm = (handler: (messages: ChatMessage[], signal?: AbortSignal, maxOutputTokens?: number) => Promise<string>) => ({ summarize: vi.fn(handler) }) as unknown as LlmService

describe('context projection and durable history', () => {
  it('reallocates unused layer budget to recent turns while retaining all layer caps', () => {
    const settings = { L0: { initial: 500, max: 800 }, L1: { initial: 200, max: 400 }, L2: { initial: 100, max: 300 }, L3: { initial: 100, max: 300 } }
    expect(allocateLayerBudgets(1000, settings, { L0: 800, L1: 0, L2: 0, L3: 0 })).toEqual({ L0: 800, L1: 0, L2: 0, L3: 0 })
    expect(allocateLayerBudgets(1000, settings, { L0: 800, L1: 400, L2: 300, L3: 300 })).toEqual({ L0: 600, L1: 200, L2: 100, L3: 100 })
  })

  it('compresses at the soft threshold and promotes older raw history across four layers', async () => {
    const { config, runtime } = await fixture({
      contextInputTokens: 1024,
      context: { softThreshold: 0.65, layers: { L0: { initial: 260, max: 430 }, L1: { initial: 80, max: 140 }, L2: { initial: 64, max: 110 }, L3: { initial: 40, max: 90 } } },
    })
    try {
      const session = runtime.ctx.session.createSession()
      const task = runtime.ctx.session.startTask(session.id, 'track the investigation')
      const seen: string[] = []
      const model = llm(async (messages) => {
        const source = JSON.stringify(messages)
        seen.push(source)
        if (source.includes('Summarize early history aggressively')) return 'L3 open issue'
        if (source.includes('Summarize middle history moderately')) return 'L2 durable decision and open issue'
        return 'L1 concise actions and findings, retain conclusions'
      })
      let final: ChatMessage[] = []
      const observed = new Set<string>()
      const representative = new Map<string, string>()
      for (let index = 0; index < 38; index++) {
        runtime.ctx.session.appendMessage(task.id, { role: 'assistant', content: `finding-${index} ${'detail '.repeat(35)}` })
        final = await buildContext(config, runtime.ctx.session, model, session.id, [], [])
        for (const checkpoint of runtime.ctx.session.listContextCheckpoints(session.id)) {
          observed.add(checkpoint.level)
          if (!representative.has(checkpoint.level)) representative.set(checkpoint.level, checkpoint.content)
        }
        expect(final.reduce((sum, message) => sum + estimateTokens(message), 0) + estimateTokens([])).toBeLessThanOrEqual(896)
      }
      const checkpoints = runtime.ctx.session.listContextCheckpoints(session.id)
      expect(observed).toEqual(new Set(['L1', 'L2', 'L3']))
      expect(estimateTokens(representative.get('L1'))).toBeGreaterThan(estimateTokens(representative.get('L2')))
      expect(estimateTokens(representative.get('L2'))).toBeGreaterThan(estimateTokens(representative.get('L3')))
      expect(checkpoints.every((item) => item.fromMessageId <= item.throughMessageId)).toBe(true)
      expect(seen.some((value) => value.includes('finding-0'))).toBe(true)
      expect(seen.some((value) => value.includes('Summarize early history aggressively'))).toBe(true)
      expect(final.at(-1)?.content).toContain('finding-37')
      const orderedLevels = final.map((item) => item.content ?? '').filter((item) => item.startsWith('Summary of earlier conversation')).map((item) => item.match(/\((L[123]);/)![1])
      expect(orderedLevels).toEqual([...orderedLevels].sort((a, b) => Number(b[1]) - Number(a[1])))
      expect(runtime.ctx.session.listMessages(session.id)).toHaveLength(39)
    } finally { await runtime.dispose() }
  })
  it('persists the full Agent tool result before shortening model context', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'miniharness-agent-context-'))
    dirs.push(root)
    const config = configSchema.parse({ projectRoot: root, skillsDir: path.join(root, 'skills'), sessionDb: path.join(root, 'sessions.sqlite'),
      contextInputTokens: 2048, contextOutputReserve: 128,
      plugins: ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'agent'] })
    const before = process.env.DEEPSEEK_API_KEY
    process.env.DEEPSEEK_API_KEY = 'test-key'
    const requests: Array<{ messages: ChatMessage[]; tools?: unknown[] }> = []
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { messages: ChatMessage[]; tools?: unknown[] }
      requests.push(request)
      const first = requests.filter((item) => item.tools).length === 1 && !!request.tools
      return new Response(JSON.stringify({ choices: [{ finish_reason: first ? 'tool_calls' : 'stop', message: first
        ? { role: 'assistant', content: null, tool_calls: [{ id: 'agent-big-call', function: { name: 'big_result', arguments: '{}' } }] }
        : { role: 'assistant', content: 'done' } }] }), { status: 200 })
    }) as typeof fetch
    const runtime = await createRuntime(config, fetchMock)
    try {
      const full = `START-${'Z'.repeat(40_000)}-END`
      runtime.ctx.tools.replaceSource('test', [{ definition: { name: 'big_result', description: 'large result', permission: 'read', parameters: { type: 'object' } }, validate: () => ({}), execute: async () => ({ content: [{ type: 'text', text: full }], isError: false }) }])
      const session = runtime.ctx.session.createSession()
      expect(await runtime.ctx.agent.run('call big_result', session.id)).toBe('done')
      const task = runtime.ctx.session.listTasks(session.id)[0]
      const stored = runtime.ctx.session.listCalls(task.id)[0].result!
      expect(stored.length).toBeGreaterThan(40_000)
      expect(stored).toContain('START-')
      expect(stored).toContain('-END')
      expect(runtime.ctx.session.listMessages(session.id).find((entry) => entry.message.tool_call_id === 'agent-big-call')?.message.content).toBe(stored)
      expect(requests.filter((item) => item.tools)).toHaveLength(2)
    } finally {
      await runtime.dispose()
      if (before === undefined) delete process.env.DEEPSEEK_API_KEY
      else process.env.DEEPSEEK_API_KEY = before
    }
  })

  it('summarizes original tool bytes in bounded chunks and retains complete call pairs', async () => {
    const { config, runtime } = await fixture()
    try {
      const session = runtime.ctx.session.createSession()
      const task = runtime.ctx.session.startTask(session.id, 'inspect the project')
      const marker = 'END-OF-ORIGINAL-TOOL-RESULT'
      const content = `${'x'.repeat(7500)}${marker}`
      const call = { id: 'large-call', name: 'read_file', arguments: '{"path":"big.txt"}' }
      runtime.ctx.session.recordAssistant(task.id, { role: 'assistant', content: null, tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }] }, [call], 1)
      runtime.ctx.session.finishCall(call.id, 'succeeded', content)
      const seen: string[] = []
      const model = llm(async (messages) => {
        expect(messages.reduce((sum, message) => sum + estimateTokens(message), 0) + estimateTokens([])).toBeLessThanOrEqual(1050)
        seen.push(messages.map((message) => message.content ?? '').join(''))
        return 'The earlier read found a large file.'
      })
      const result = await buildContext(config, runtime.ctx.session, model, session.id, [], [])
      expect(seen.join('')).toContain(marker)
      expect(runtime.ctx.session.listMessages(session.id).find((entry) => entry.message.tool_call_id === call.id)?.message.content).toBe(content)
      const calls = result.flatMap((message) => message.tool_calls ?? []).map((item) => item.id)
      const results = result.filter((message) => message.role === 'tool').map((message) => message.tool_call_id)
      expect(calls).toEqual(results)
      expect(runtime.ctx.session.getSummary(session.id)).toBeDefined()
    } finally { await runtime.dispose() }
  })

  it('compresses a single long task repeatedly and reads only after its checkpoint', async () => {
    const { config, runtime } = await fixture()
    try {
      const session = runtime.ctx.session.createSession()
      const task = runtime.ctx.session.startTask(session.id, 'long investigation')
      const model = llm(async () => 'Findings and pending investigation steps.')
      for (let index = 0; index < 9; index++) runtime.ctx.session.appendMessage(task.id, { role: 'assistant', content: `finding-${index} ${'details '.repeat(90)}` })
      const first = await buildContext(config, runtime.ctx.session, model, session.id, [], [], undefined, { taskId: task.id, includeSessionHistory: false })
      const checkpoint = runtime.ctx.session.getSummary(session.id, task.id)!
      expect(checkpoint.throughMessageId).toBeGreaterThan(0)
      expect(first.some((message) => message.content?.includes('Summary of earlier conversation'))).toBe(true)
      runtime.ctx.session.appendMessage(task.id, { role: 'assistant', content: `new finding ${'more '.repeat(450)}` })
      const since = vi.spyOn(runtime.ctx.session, 'listMessagesSince')
      await buildContext(config, runtime.ctx.session, model, session.id, [], [], undefined, { taskId: task.id, includeSessionHistory: false })
      expect(since).toHaveBeenCalledWith(session.id, checkpoint.throughMessageId, task.id)
      expect(runtime.ctx.session.getSummary(session.id, task.id)!.throughMessageId).toBeGreaterThan(checkpoint.throughMessageId)
      expect(runtime.ctx.session.listMessages(session.id).at(-1)?.message.content).toContain('new finding')
    } finally { await runtime.dispose() }
  })

  it('loads layered checkpoints after runtime restart and only summarizes new raw messages', async () => {
    const { config, runtime } = await fixture()
    const session = runtime.ctx.session.createSession()
    const task = runtime.ctx.session.startTask(session.id, 'resume investigation')
    for (let index = 0; index < 12; index++) runtime.ctx.session.appendMessage(task.id, { role: 'assistant', content: `earlier-${index} ${'detail '.repeat(50)}` })
    const model = llm(async () => 'Durable finding from earlier history.')
    await buildContext(config, runtime.ctx.session, model, session.id, [], [])
    const prior = runtime.ctx.session.listContextCheckpoints(session.id)
    expect(prior.length).toBeGreaterThan(0)
    await runtime.dispose()
    const reopened = await createRuntime(config)
    try {
      reopened.ctx.session.appendMessage(task.id, { role: 'assistant', content: 'fresh finding after restart' })
      const since = vi.spyOn(reopened.ctx.session, 'listMessagesSince')
      const projected = await buildContext(config, reopened.ctx.session, model, session.id, [], [])
      expect(since).toHaveBeenCalledWith(session.id, Math.max(...prior.map((item) => item.throughMessageId)), undefined)
      expect(JSON.stringify(projected)).toContain('fresh finding after restart')
      expect(reopened.ctx.session.listMessages(session.id)).toHaveLength(14)
    } finally { await reopened.dispose() }
  })

  it('keeps every call ID, arguments, and matching result when a tool result is projected shorter', async () => {
    const { config, runtime } = await fixture()
    try {
      const session = runtime.ctx.session.createSession()
      const task = runtime.ctx.session.startTask(session.id, 'check two files')
      const calls = ['one', 'two'].map((id) => ({ id, name: 'read_file', arguments: JSON.stringify({ path: `${id}.txt` }) }))
      runtime.ctx.session.recordAssistant(task.id, { role: 'assistant', content: null,
        tool_calls: calls.map((call) => ({ id: call.id, type: 'function' as const, function: { name: call.name, arguments: call.arguments } })) }, calls, 1)
      for (const call of calls) runtime.ctx.session.finishCall(call.id, 'succeeded', `${call.id}-${'value '.repeat(1000)}`)
      const projected = await buildContext(config, runtime.ctx.session, llm(async () => 'unused'), session.id, [], [], undefined, { enhance: false })
      const assistant = projected.find((message) => message.tool_calls?.length === 2)!
      expect(assistant.tool_calls?.map((call) => [call.id, call.function.arguments])).toEqual(calls.map((call) => [call.id, call.arguments]))
      expect(projected.filter((message) => message.role === 'tool').map((message) => message.tool_call_id)).toEqual(['one', 'two'])
      expect(projected.find((message) => message.tool_call_id === 'one')?.content).toContain('projection')
      expect(runtime.ctx.session.listMessages(session.id).find((entry) => entry.message.tool_call_id === 'one')?.message.content).toContain('value '.repeat(1000))
    } finally { await runtime.dispose() }
  })

  it('does not mix session or task scoped summaries', async () => {
    const { config, runtime } = await fixture()
    try {
      const one = runtime.ctx.session.createSession()
      const two = runtime.ctx.session.createSession()
      const old = runtime.ctx.session.startTask(one.id, 'secret for old task')
      runtime.ctx.session.appendMessage(old.id, { role: 'assistant', content: 'old secret' })
      runtime.ctx.session.setTaskStatus(old.id, 'completed')
      runtime.ctx.session.saveSummary(one.id, 1, 2, 'SESSION SECRET')
      runtime.ctx.session.saveSummary(one.id, 1, 2, 'TASK SECRET', old.id)
      const current = runtime.ctx.session.startTask(one.id, 'current task')
      const other = runtime.ctx.session.startTask(two.id, 'other session')
      const model = llm(async () => 'summary')
      const onlyCurrent = await buildContext(config, runtime.ctx.session, model, one.id, [], [], undefined, { taskId: current.id, includeSessionHistory: false })
      expect(JSON.stringify(onlyCurrent)).not.toMatch(/SECRET|old secret/)
      const otherSession = await buildContext(config, runtime.ctx.session, model, two.id, [], [])
      expect(JSON.stringify(otherSession)).not.toMatch(/SECRET|old secret/)
      expect(runtime.ctx.session.getSummary(two.id)).toBeUndefined()
      expect(runtime.ctx.session.getSummary(one.id, current.id)).toBeUndefined()
      expect(runtime.ctx.session.getSummary(one.id, old.id)?.content).toBe('TASK SECRET')
      expect(other.id).not.toBe(current.id)
    } finally { await runtime.dispose() }
  })

  it('keeps raw history and reports budget overflow after summary failure', async () => {
    const { config, runtime } = await fixture()
    try {
      const session = runtime.ctx.session.createSession()
      const task = runtime.ctx.session.startTask(session.id, `large prompt ${'irreducible '.repeat(700)}`)
      const model = llm(async () => { throw new Error('summary service unavailable') })
      await expect(buildContext(config, runtime.ctx.session, model, session.id, [], [])).rejects.toThrow(/Context exceeds token budget.*summary failed after three budget attempts: summary service unavailable/)
      expect(runtime.ctx.session.getSummary(session.id)).toBeUndefined()
      expect(runtime.ctx.session.listMessages(session.id)[0].message.content).toBe(task.prompt)
    } finally { await runtime.dispose() }
  })

  it('keeps an existing L3 checkpoint and raw messages when a new summary exceeds its layer budget', async () => {
    const { config, runtime } = await fixture({
      contextInputTokens: 1024,
      context: { softThreshold: 0.6, layers: { L0: { initial: 200, max: 400 }, L1: { initial: 50, max: 80 }, L2: { initial: 40, max: 70 }, L3: { initial: 32, max: 60 } } },
    })
    try {
      const session = runtime.ctx.session.createSession()
      const task = runtime.ctx.session.startTask(session.id, 'keep durable findings')
      runtime.ctx.session.appendMessage(task.id, { role: 'assistant', content: 'earlier durable decision' })
      runtime.ctx.session.replaceContextCheckpoints(session.id, [], { sessionId: session.id, taskId: task.id, level: 'L3', fromMessageId: 1, throughMessageId: 2, content: 'valid prior L3 fact' }, task.id)
      for (let index = 0; index < 12; index++) runtime.ctx.session.appendMessage(task.id, { role: 'assistant', content: `new-${index} ${'raw detail '.repeat(150)}` })
      const originalMessages = runtime.ctx.session.listMessages(session.id)
      const priorCheckpoints = runtime.ctx.session.listContextCheckpoints(session.id)
      const summarize = vi.fn(async (_messages: ChatMessage[], _signal?: AbortSignal, _maxOutputTokens?: number) => 'oversized summary '.repeat(120))
      await expect(buildContext(config, runtime.ctx.session, llm(summarize), session.id, [], [], undefined, { taskId: task.id })).rejects.toThrow(/summary failed after three budget attempts/)
      expect(summarize.mock.calls.length).toBeGreaterThanOrEqual(3)
      expect(summarize.mock.calls.slice(0, 3).every((call) => typeof call[2] === 'number')).toBe(true)
      expect(summarize.mock.calls[1][2]).toBeLessThan(summarize.mock.calls[0][2]!)
      expect(summarize.mock.calls[2][2]).toBeLessThan(summarize.mock.calls[1][2]!)
      expect(runtime.ctx.session.listContextCheckpoints(session.id)).toEqual(priorCheckpoints)
      expect(runtime.ctx.session.listMessages(session.id)).toEqual(originalMessages)
    } finally { await runtime.dispose() }
  })
})
