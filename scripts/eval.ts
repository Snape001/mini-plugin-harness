import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'
import { TaskPausedError } from '../src/plugins/agent.js'
import type { ToolRegistration } from '../src/types.js'

type ScenarioResult = { name: string; status: 'passed' | 'failed' | 'skipped'; durationMs: number; detail?: string }
const results: ScenarioResult[] = []
const tempRoots: string[] = []
const evalApiKey = 'miniharness-local-eval-key'
const previousApiKey = process.env.DEEPSEEK_API_KEY
const previousLogLevel = process.env.LOG_LEVEL
process.env.DEEPSEEK_API_KEY = evalApiKey
process.env.LOG_LEVEL = 'error'

async function tempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'miniharness-eval-'))
  tempRoots.push(root)
  await mkdir(path.join(root, 'skills'), { recursive: true })
  return root
}

function makeConfig(root: string, overrides: Record<string, unknown> = {}) {
  return configSchema.parse({
    projectRoot: root,
    skillsDir: path.join(root, 'skills'),
    sessionDb: path.join(root, '.miniharness', 'sessions.sqlite'),
    maxIterations: 4,
    maxTaskIterations: 10,
    toolRetries: 1,
    plugins: ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'agent'],
    ...overrides,
  })
}

async function scenario(name: string, run: () => Promise<string | void>) {
  const started = Date.now()
  try {
    const detail = await run()
    results.push({ name, status: 'passed', durationMs: Date.now() - started, ...(detail ? { detail } : {}) })
  } catch (error) {
    results.push({ name, status: 'failed', durationMs: Date.now() - started, detail: error instanceof Error ? error.message : String(error) })
  }
}

async function fileSafety() {
  const root = await tempRoot()
  const outside = await tempRoot()
  const externalFile = path.join(outside, 'secret.txt')
  await writeFile(externalFile, 'external secret')
  const runtime = await createRuntime(makeConfig(root, {
    plugins: ['logger', 'hooks', 'permission', 'tools'],
    permissions: { allow: ['write_file'] },
  }))
  try {
    await runtime.ctx.tools.execute('write_file', { path: 'inside.txt', content: 'inside' })
    if ((await readFile(path.join(root, 'inside.txt'), 'utf8')) !== 'inside') throw new Error('project write did not persist')
    await expectReject(runtime.ctx.tools.execute('read_file', { path: '../secret.txt' }), 'root traversal was accepted')
    await expectReject(runtime.ctx.tools.execute('read_file', { path: '.miniharness/sessions.sqlite' }), 'session data was readable')
    if (process.platform !== 'win32') {
      const link = path.join(root, 'secret-link.txt')
      await symlink(externalFile, link)
      await expectReject(runtime.ctx.tools.execute('read_file', { path: 'secret-link.txt' }), 'symlink was followed')
      await expectReject(runtime.ctx.tools.execute('write_file', { path: 'secret-link.txt', content: 'overwrite' }), 'symlink was overwritten')
    }
    if ((await readFile(externalFile, 'utf8')) !== 'external secret') throw new Error('outside file changed')
    return process.platform === 'win32' ? 'Path/session boundaries passed; symlink checks skipped on Windows.' : 'Path, session-data, and symlink boundaries passed.'
  } finally { await runtime.dispose() }
}

async function cancellationRecovery() {
  const root = await tempRoot()
  const toolStarted = deferred<void>()
  const fakeFetch = (async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: {
    role: 'assistant', content: null, tool_calls: [{ id: 'eval-cancel-call', type: 'function', function: { name: 'wait_for_cancel', arguments: '{}' } }],
  } }] }), { status: 200 })) as typeof fetch
  const runtime = await createRuntime(makeConfig(root), fakeFetch)
  const registration: ToolRegistration = {
    definition: { name: 'wait_for_cancel', description: 'Waits until the eval cancels it.', permission: 'read', parameters: { type: 'object' } },
    validate: () => ({}),
    execute: async (_args, options) => new Promise(() => {
      toolStarted.resolve()
      if (!options?.signal) throw new Error('AbortSignal was not forwarded to the active tool')
    }),
  }
  runtime.ctx.tools.replaceSource('eval', [registration])
  try {
    const session = runtime.ctx.session.createSession()
    const controller = new AbortController()
    const pending = runtime.ctx.agent.run('cancel while a tool is active', session.id, undefined, controller.signal)
    await toolStarted.promise
    controller.abort(new Error('eval cancellation'))
    await expectReject(pending, 'cancelled task unexpectedly completed')
    const task = runtime.ctx.session.listTasks(session.id)[0]
    const call = runtime.ctx.session.listCalls(task.id)[0]
    const attempts = runtime.ctx.session.listAttempts(call.id)
    if (task.status !== 'interrupted' || call.status !== 'unknown' || attempts.some((item) => item.status !== 'unknown')) {
      throw new Error(`Expected interrupted/unknown recovery state, got ${task.status}/${call.status}/${attempts.map((item) => item.status).join(',')}`)
    }
    if (attempts.length !== 1) throw new Error(`Cancellation retried the tool ${attempts.length} times`)
    return 'Active call became unknown and the task remained resumable without replay.'
  } finally { await runtime.dispose() }
}

async function mcpFailureIsolation() {
  const root = await tempRoot()
  const runtime = await createRuntime(makeConfig(root, {
    plugins: ['logger', 'hooks', 'permission', 'llm', 'tools', 'mcp', 'skills', 'session', 'agent'],
    mcp: { servers: [{ id: 'offline', transport: 'http', url: 'http://127.0.0.1:1/mcp' }], connectTimeoutMs: 500, reconnectProbeMs: 20 },
  }))
  try {
    const builtins = runtime.ctx.tools.definitions().map((tool) => tool.name)
    if (!builtins.includes('read_file')) throw new Error('local tools were unavailable after MCP startup failure')
    if (builtins.some((name) => name.startsWith('mcp_offline_'))) throw new Error('offline MCP tools were registered')
    if (!runtime.ctx.get('mcp')) throw new Error('MCP lifecycle service was not installed')
    return 'Unavailable local MCP server was isolated; built-in tools remained available.'
  } finally { await runtime.dispose() }
}

async function toolFailureTrace() {
  const root = await tempRoot()
  let requests = 0
  const fakeFetch = (async () => {
    requests++
    const message = requests === 1
      ? { role: 'assistant', content: null, tool_calls: [{ id: 'eval-failure-call', type: 'function', function: { name: 'always_fails', arguments: '{}' } }] }
      : { role: 'assistant', content: 'Recovered after the tool error.' }
    return new Response(JSON.stringify({ choices: [{ finish_reason: requests === 1 ? 'tool_calls' : 'stop', message }] }), { status: 200 })
  }) as typeof fetch
  const runtime = await createRuntime(makeConfig(root), fakeFetch)
  runtime.ctx.tools.replaceSource('eval', [{
    definition: { name: 'always_fails', description: 'Fails deterministically for eval.', permission: 'read', parameters: { type: 'object' } },
    validate: () => ({}),
    execute: () => { throw new Error('deterministic tool failure') },
  }])
  try {
    const session = runtime.ctx.session.createSession()
    const answer = await runtime.ctx.agent.run('exercise a failing tool', session.id)
    const attempts = runtime.ctx.session.listAttempts('eval-failure-call')
    if (!answer.includes('Recovered')) throw new Error('Agent did not recover from the tool error')
    if (attempts.length !== 2 || attempts.some((item) => item.status !== 'failed' || item.errorCode !== 'TOOL_EXECUTION_FAILED')) {
      throw new Error(`Unexpected retry trace: ${JSON.stringify(attempts)}`)
    }
    return 'Read-only tool failure retried once and both attempts were persisted.'
  } finally { await runtime.dispose() }
}

async function longTaskResume() {
  const root = await tempRoot()
  const replies = [
    { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'eval-segment-call', type: 'function', function: { name: 'list_files', arguments: '{}' } }] } }] },
    { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Completed on the next segment.' } }] },
  ]
  const fakeFetch = (async () => new Response(JSON.stringify(replies.shift()), { status: 200 })) as typeof fetch
  const runtime = await createRuntime(makeConfig(root, { maxIterations: 1, maxTaskIterations: 3 }), fakeFetch)
  try {
    const session = runtime.ctx.session.createSession()
    let paused = false
    try { await runtime.ctx.agent.run('continue over multiple segments', session.id) }
    catch (error) { if (error instanceof TaskPausedError) paused = true; else throw error }
    const task = runtime.ctx.session.listTasks(session.id)[0]
    if (!paused || task.status !== 'paused' || task.iteration !== 1) throw new Error(`Task did not pause at its segment boundary: ${task.status}/${task.iteration}`)
    const answer = await runtime.ctx.agent.resume(task.id)
    if (answer !== 'Completed on the next segment.' || runtime.ctx.session.getTask(task.id).status !== 'completed') throw new Error('Paused task failed to complete after resume')
    return 'Per-segment pause and manual resume completed in the same task.'
  } finally { await runtime.dispose() }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

async function expectReject(promise: Promise<unknown>, message: string) {
  try { await promise } catch { return }
  throw new Error(message)
}

async function main() {
  await scenario('file-safety', fileSafety)
  await scenario('cancellation-recovery', cancellationRecovery)
  await scenario('mcp-failure-isolation', mcpFailureIsolation)
  await scenario('tool-failure-trace', toolFailureTrace)
  await scenario('long-task-resume', longTaskResume)

  const reportDirectory = path.resolve('.miniharness', 'evals')
  await mkdir(reportDirectory, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(reportDirectory, `${timestamp}.json`)
  const report = { version: 1, createdAt: new Date().toISOString(), scenarios: results, summary: {
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    durationMs: results.reduce((total, result) => total + result.durationMs, 0),
  } }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  for (const result of results) process.stdout.write(`${result.status.toUpperCase()} ${result.name} (${result.durationMs} ms)${result.detail ? ` — ${result.detail}` : ''}\n`)
  process.stdout.write(`Eval report: ${reportPath}\n`)
  process.stdout.write(`Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped\n`)
  process.exitCode = report.summary.failed ? 1 : 0
}

try { await main() }
finally {
  if (previousApiKey === undefined) delete process.env.DEEPSEEK_API_KEY
  else process.env.DEEPSEEK_API_KEY = previousApiKey
  if (previousLogLevel === undefined) delete process.env.LOG_LEVEL
  else process.env.LOG_LEVEL = previousLogLevel
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
}
