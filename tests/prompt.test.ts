import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'

const dirs: string[] = []
async function workspace() { const root = await mkdtemp(path.join(os.tmpdir(), 'miniharness-prompt-')); dirs.push(root); await mkdir(path.join(root, 'prompts')); return root }
const config = (root: string, extra: Record<string, unknown> = {}) => configSchema.parse({ projectRoot: root, skillsDir: path.join(root, 'skills'), promptsDir: path.join(root, 'prompts'), sessionDb: path.join(root, 'session.sqlite'), plugins: ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'prompt', 'agent'], ...extra })
afterEach(async () => { delete process.env.DEEPSEEK_API_KEY; await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

describe('Prompt plugin', () => {
  it('loads YAML and Markdown, renders selected templates, and stores actual request traces', async () => {
    process.env.DEEPSEEK_API_KEY = 'test'
    const root = await workspace()
    await writeFile(path.join(root, 'prompts', 'system.yaml'), "name: expert\ndescription: Specialist role\nversion: '1'\ntype: system\ntemplate: 'Expert in {{projectRoot}}'\n")
    await writeFile(path.join(root, 'prompts', 'review.md'), '---\nname: review\ndescription: Review task\nversion: "2"\ntype: task\nscenarios: [review]\nstages: [initial]\n---\nReview: {{task}}')
    const requests: Array<{ messages: Array<{ role: string; content: string }> }> = []
    const fetcher = vi.fn(async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'done' } }], usage: { prompt_tokens: 42, completion_tokens: 3, total_tokens: 45 } }), { status: 200 })
    }) as typeof fetch
    const runtime = await createRuntime(config(root), fetcher)
    try {
      const session = runtime.ctx.session.createSession()
      await runtime.ctx.agent.run('check code', session.id, undefined, undefined, { taskType: 'review', versions: { 'task/review': '2' } })
      const taskId = runtime.ctx.session.listTasks(session.id)[0].id
      const trace = runtime.ctx.prompt.traces(taskId)[0]
      expect(trace).toMatchObject({ stage: 'initial', status: 'completed', inputTokens: 42, totalTokens: 45 })
      expect(trace.templates.map((item) => item.id)).toContain('task/review@2')
      expect(trace.messages).toEqual(requests[0].messages)
      expect(requests[0].messages[0].content).toContain('Expert in')
      expect(requests[0].messages.filter((item) => item.content?.includes('Review: check code'))).toHaveLength(1)
      expect(runtime.ctx.prompt.get('task/review@2')?.version).toBe('2')
      runtime.ctx.prompt.setEnabled('task/review@2', false)
      expect(runtime.ctx.prompt.get('task/review@2')?.enabled).toBe(false)
    } finally { await runtime.dispose() }
  })

  it('rejects invalid variables and explicit disabled versions', async () => {
    const root = await workspace()
    await writeFile(path.join(root, 'prompts', 'bad.yaml'), "name: bad\ndescription: Bad\nversion: '1'\ntype: system\ntemplate: '{{task}}'\n")
    await expect(createRuntime(config(root))).rejects.toThrow(/unsafe variable/)
    await rm(path.join(root, 'prompts', 'bad.yaml'))
    const runtime = await createRuntime(config(root))
    try {
      runtime.ctx.prompt.setEnabled('task/default@1', false)
      const session = runtime.ctx.session.createSession()
      await expect(runtime.ctx.agent.run('hi', session.id, undefined, undefined, { versions: { 'task/default': '1' } })).rejects.toThrow(/unavailable or disabled/)
    } finally { await runtime.dispose() }
  })

  it('uses optional LLM selection and falls back to stable rules on invalid choice', async () => {
    process.env.DEEPSEEK_API_KEY = 'test'
    const root = await workspace()
    for (const name of ['alpha', 'beta']) await writeFile(path.join(root, 'prompts', `${name}.yaml`), `name: ${name}\ndescription: ${name} task\nversion: '1'\ntype: task\ntemplate: '${name} {{task}}'\n`)
    const selected = ['task/beta@1', 'invalid-id']
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: selected.shift() } }] }), { status: 200 })) as typeof fetch
    const runtime = await createRuntime(config(root, { prompts: { selector: 'llm' } }), fetcher)
    try {
      const session = runtime.ctx.session.createSession()
      const task = runtime.ctx.session.startTask(session.id, 'inspect')
      const snapshot = await runtime.ctx.prompt.prepare(task.id, 'inspect')
      expect((await runtime.ctx.prompt.render(snapshot, 'initial', 'inspect', [])).task).toBe('beta inspect')
      expect((await runtime.ctx.prompt.render(snapshot, 'initial', 'inspect', [])).task).toBe('alpha inspect')
    } finally { await runtime.dispose() }
  })

  it('keeps versioned templates across restart and records missing API usage as null', async () => {
    process.env.DEEPSEEK_API_KEY = 'test'
    const root = await workspace()
    const file = path.join(root, 'prompts', 'task.yaml')
    await writeFile(file, "name: custom\ndescription: Custom\nversion: '1'\ntype: task\ntemplate: 'First {{task}}'\n")
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'call-1', function: { name: 'list_files', arguments: '{}' } }] } }] }), { status: 200 })) as typeof fetch
    const settings = config(root, { maxIterations: 1, maxTaskIterations: 3 })
    const first = await createRuntime(settings, fetcher)
    const session = first.ctx.session.createSession()
    await expect(first.ctx.agent.run('inspect', session.id)).rejects.toThrow(/paused/)
    const taskId = first.ctx.session.listTasks(session.id)[0].id
    await first.dispose()
    await writeFile(file, "name: custom\ndescription: Custom\nversion: '1'\ntype: task\ntemplate: 'Changed {{task}}'\n")
    const second = await createRuntime(settings, vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'done' } }] }), { status: 200 })) as typeof fetch)
    try {
      await second.ctx.agent.resume(taskId)
      const traces = second.ctx.prompt.traces(taskId)
      expect(traces).toHaveLength(2)
      expect(traces[1].stage).toBe('resume')
      expect(JSON.stringify(traces[1].messages)).toContain('First inspect')
      expect(traces[1].totalTokens).toBeNull()
    } finally { await second.dispose() }
  })
})
