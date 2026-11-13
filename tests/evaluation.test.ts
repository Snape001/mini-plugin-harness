import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { benchmarkTasks, candidateCommonTasks, candidateCoreTasks, commonBenchmarkTasks, prepareFixture } from '../src/evaluation/benchmark.js'
import { renderCsv, renderMarkdown, summarizeRuns, type EvaluationRun } from '../src/evaluation/metrics.js'
import { evaluateSkillSelection, evaluationContextSettings, evaluationGroups, missingUsageRequestCapReached, runBenchmark, runPermissionScenarios, skillSelectionMatchesExpected } from '../src/evaluation/runner.js'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'

const roots: string[] = []
const previousApiKey = process.env.DEEPSEEK_API_KEY
async function tempDir() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'miniharness-eval-test-'))
  roots.push(root)
  return root
}
afterEach(async () => {
  if (previousApiKey === undefined) delete process.env.DEEPSEEK_API_KEY
  else process.env.DEEPSEEK_API_KEY = previousApiKey
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('benchmark evaluation module', () => {
  it('counts skill selection as correct only when every expected skill was selected', () => {
    expect(skillSelectionMatchesExpected(['bug-investigation', 'targeted-code-fix'], [{ selected: ['bug-investigation'] }])).toBe(false)
    expect(skillSelectionMatchesExpected(['bug-investigation', 'targeted-code-fix'], [{ selected: ['bug-investigation'] }, { selected: ['targeted-code-fix'] }])).toBe(true)
    expect(skillSelectionMatchesExpected(['code-review'], [])).toBe(false)
    expect(evaluateSkillSelection(['code-review'], false, [])).toBeNull()
    expect(evaluateSkillSelection(['bug-investigation', 'targeted-code-fix'], true, [{ selected: ['bug-investigation'] }])).toBe(false)
    expect(evaluateSkillSelection(['code-review'], true, [{ selected: ['code-review'] }])).toBe(true)
  })

  it('uses the 120-request guard only when API usage is incomplete', () => {
    expect(missingUsageRequestCapReached(121, true)).toBe(false)
    expect(missingUsageRequestCapReached(119, false)).toBe(false)
    expect(missingUsageRequestCapReached(120, false)).toBe(true)
    expect(missingUsageRequestCapReached(121, false)).toBe(true)
  })

  it('treats a task context budget as the hard input limit and records output reserve separately', () => {
    expect(evaluationContextSettings('candidate-context-page17-recall', 4096)).toEqual({ hardInputTokens: 4096, outputReserve: 2048, contextWindowTokens: 6144 })
    expect(evaluationContextSettings('context-compression', 4096)).toEqual({ hardInputTokens: 4096, outputReserve: 512, contextWindowTokens: 4608 })
    expect(evaluationContextSettings('candidate-prompt-stage-config')).toEqual({ hardInputTokens: 13_952, outputReserve: 2_048, contextWindowTokens: 16_000 })
  })

  it('retains fifteen legacy common tasks and adds twelve frozen calibration candidates', async () => {
    expect(commonBenchmarkTasks).toHaveLength(27)
    expect(candidateCommonTasks).toHaveLength(12)
    expect(candidateCoreTasks).toHaveLength(9)
    expect(new Set(candidateCoreTasks.map((task) => task.candidateFamily))).toEqual(new Set(['skills', 'prompt', 'recovery']))
    for (const family of ['skills', 'prompt', 'context', 'recovery']) expect(candidateCommonTasks.filter((task) => task.candidateFamily === family)).toHaveLength(3)
    for (const category of ['code-understanding', 'bug-fix', 'feature-development', 'engineering', 'long-running']) {
      expect(commonBenchmarkTasks.filter((task) => task.category === category)).toHaveLength(3)
    }
    for (const suite of ['skills', 'prompt', 'context', 'mcp']) expect(benchmarkTasks.filter((task) => task.suite === suite).length).toBeGreaterThanOrEqual(2)
    expect(new Set(benchmarkTasks.map((task) => task.id)).size).toBe(benchmarkTasks.length)
    const root = await tempDir()
    const fixtureRoot = path.resolve('evaluation/fixtures')
    for (const task of commonBenchmarkTasks) {
      const workspace = path.join(root, task.id)
      await mkdir(workspace, { recursive: true })
      await prepareFixture(task, workspace, fixtureRoot)
      expect(await readFile(path.join(workspace, 'answer.txt'), 'utf8').catch(() => '')).toBe('')
    }
    expect(evaluationGroups).toEqual(['baseline', 'skills', 'session-context', 'prompt', 'full', 'full-no-skills', 'full-no-prompt', 'full-no-context'])
  })

  it('grades generated bug, feature, and engineering tasks with independent acceptance programs', async () => {
    const root = await tempDir()
    const fixtureRoot = path.resolve('evaluation/fixtures')
    const bug = benchmarkTasks.find((task) => task.id === 'boundary-condition-fix')!
    await prepareFixture(bug, root, fixtureRoot)
    expect((await bug.steps[0].verify(root, '')).passed).toBe(false)
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.join(root, 'src/page.mjs'), 'export const pageIndex = (n, c) => Math.max(0, Math.min(n, c - 1))\n')
    expect((await bug.steps[0].verify(root, '')).passed).toBe(true)
    const review = benchmarkTasks.find((task) => task.id === 'code-review')!
    await prepareFixture(review, root, fixtureRoot)
    expect((await review.steps[0].verify(root, 'Looks fine.')).passed).toBe(false)
    expect((await review.steps[0].verify(root, 'Do not log token; use === strict equality.')).passed).toBe(true)
  })

  it('executes Agent modified modules without evaluator filesystem or credential access', async () => {
    const root = await tempDir()
    const workspace = path.join(root, 'workspace')
    await mkdir(workspace)
    const task = benchmarkTasks.find((item) => item.id === 'boundary-condition-fix')!
    await prepareFixture(task, workspace, path.resolve('evaluation/fixtures'))
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.join(root, 'answer.txt'), 'private answer')
    await writeFile(path.join(workspace, 'src/page.mjs'), "import { readFileSync } from 'node:fs'; readFileSync('../answer.txt'); export const pageIndex = (n,c) => Math.max(0,Math.min(n,c-1))\n")
    await expect(task.steps[0].verify(workspace, '')).rejects.toThrow()
    await writeFile(path.join(workspace, 'src/page.mjs'), "import { writeFileSync } from 'node:fs'; writeFileSync('escaped.txt','bad'); export const pageIndex = (n,c) => Math.max(0,Math.min(n,c-1))\n")
    await expect(task.steps[0].verify(workspace, '')).rejects.toThrow()
    expect(await readFile(path.join(workspace, 'escaped.txt'), 'utf8').catch(() => '')).toBe('')
  })

  it('accepts meaningful node:test additions inside the restricted verifier', async () => {
    const root = await tempDir()
    const task = benchmarkTasks.find((item) => item.id === 'unit-test-addition')!
    await prepareFixture(task, root, path.resolve('evaluation/fixtures'))
    const { writeFile } = await import('node:fs/promises')
    await mkdir(path.join(root, 'tests'), { recursive: true })
    await writeFile(path.join(root, 'tests/math.test.mjs'), "import { test } from 'node:test'\nimport { strictEqual } from 'node:assert/strict'\nimport { isEven } from '../src/math.mjs'\ntest('even', () => strictEqual(isEven(2), true))\ntest('odd', () => strictEqual(isEven(3), false))\ntest('zero', () => strictEqual(isEven(0), true))\ntest('fraction', () => strictEqual(isEven(2.5), false))\n")
    expect(await task.steps[0].verify(root, '')).toEqual({ passed: true, detail: 'Four passing node:test cases are required.' })
  })

  it('approves only the workspace-scoped test runner and records its output', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const testSource = "import { test } from 'node:test'\nimport { strictEqual } from 'node:assert/strict'\nimport { isEven } from '../src/math.mjs'\ntest('even', () => strictEqual(isEven(2), true))\ntest('odd', () => strictEqual(isEven(3), false))\ntest('zero', () => strictEqual(isEven(0), true))\ntest('fraction', () => strictEqual(isEven(2.5), false))\n"
    let request = 0
    const fakeFetch = vi.fn(async () => {
      request++
      const message = request === 1
        ? { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'write-tests', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ path: 'tests/math.test.mjs', content: testSource }) } }] } }
        : request === 2
          ? { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'run-tests', type: 'function', function: { name: 'run_node_tests', arguments: JSON.stringify({ path: 'tests/math.test.mjs' }) } }] } }
          : { finish_reason: 'stop', message: { role: 'assistant', content: 'All four tests pass.' } }
      return new Response(JSON.stringify({ choices: [message], usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['unit-test-addition'], groups: ['baseline'], repetitions: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    const [run] = result.report.runs
    expect(run.status, run.detail).toBe('passed')
    const testCall = run.toolTrace?.find((call) => call.name === 'run_node_tests')
    expect(testCall?.status, JSON.stringify(testCall)).toBe('succeeded')
    expect(testCall?.attempts).toContainEqual(expect.objectContaining({ status: 'succeeded', approval: 'approved' }))
    expect(testCall?.result).toMatch(/pass\s+4/)
    expect(run.toolTrace?.some((call) => call.name === 'run_shell')).toBe(false)
  })

  it('records Prompt traces only for the Prompt ablation and compares common tasks on equal fixtures', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'DEFAULT_TIMEOUT_MS is 2500 in src/limits.mjs.' } }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }), { status: 200 })) as typeof fetch
    const result = await runBenchmark({ tasks: ['locate-constant'], groups: ['baseline', 'prompt'], repetitions: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    expect(result.report.runs.map((run) => run.status)).toEqual(['passed', 'passed'])
    expect(result.report.runs[0].promptTraces).toHaveLength(0)
    expect(result.report.runs[1].promptTraces).toHaveLength(1)
    expect(result.report.runs[1].promptStageCompliant).toBe(true)
    expect(result.report.runs[1].promptTraces?.[0].templates.map((item) => item.id)).toContain('task/benchmark-initial@2')
    expect(result.report.runs[1].promptTraces?.[0].messages.some((item) => item.role === 'user' && item.content?.includes('Check the relevant files'))).toBe(true)
    expect(result.report.runs[1].contextRequests?.[0]).toMatchObject({ step: 0, recentTaskPresent: true, toolLinksValid: true })
    expect(result.report.runs.map((run) => run.suite)).toEqual(['common', 'common'])
  })

  it('routes real Agent tool followup requests through the pinned Prompt version', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    let requests = 0
    const fakeFetch = vi.fn(async () => {
      requests++
      const choice = requests === 1
        ? { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'read-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"src/limits.mjs"}' } }] } }
        : { finish_reason: 'stop', message: { role: 'assistant', content: 'DEFAULT_TIMEOUT_MS is 2500 in src/limits.mjs.' } }
      return new Response(JSON.stringify({ choices: [choice], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['locate-constant'], groups: ['prompt'], repetitions: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    const [run] = result.report.runs
    expect(run.status).toBe('passed')
    expect(run.promptStageCompliant).toBe(true)
    expect(run.promptTraces?.map((trace) => trace.stage)).toEqual(['initial', 'tool_followup'])
    expect(run.promptTraces?.map((trace) => trace.templates.find((item) => item.id.startsWith('task/'))?.id)).toEqual(['task/benchmark-initial@2', 'task/benchmark-followup@1'])
    expect(run.contextRequests?.[1]).toMatchObject({ recentTaskPresent: true, toolLinksValid: true })
  })

  it('records all eight ablation switches with the same limits and task set', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { response_format?: unknown }
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: body.response_format ? '{"skills":[]}' : 'DEFAULT_TIMEOUT_MS is 2500 in src/limits.mjs.' } }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['locate-constant'], groups: evaluationGroups, repetitions: 1, maxAgentRounds: 60, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    expect(result.report.runs.every((run) => run.status === 'passed')).toBe(true)
    expect(result.report.parameters).toMatchObject({ maxAgentRounds: 60, maxTotalRequests: 120, maxTotalTokens: 250_000, recoverySegmentIterations: 8, wallClockLimitMs: 900_000 })
    expect(result.report.configurations['full-no-skills'].capabilities).toMatchObject({ skills: false, sessionContext: true, contextEnhancements: true, recovery: true })
    expect(result.report.configurations['full-no-prompt'].plugins).not.toContain('prompt')
    expect(result.report.configurations['full-no-context'].capabilities).toMatchObject({ skills: true, sessionContext: false, contextEnhancements: false, recovery: true })
    expect(result.report.taskSet[0]).toMatchObject({ id: 'locate-constant', suite: 'common' })
    expect(result.markdown).toContain('Full-minus-one attribution contrasts')
  })

  it('measures Context preservation from actual Agent requests across tasks', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    let requests = 0
    const fakeFetch = vi.fn(async () => {
      requests++
      const choice = requests === 2
        ? { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'write-1', type: 'function', function: { name: 'write_file', arguments: '{"path":"handoff.txt","content":"ORCHID-417"}' } }] } }
        : { finish_reason: 'stop', message: { role: 'assistant', content: requests === 1 ? 'The handoff code is ORCHID-417.' : 'Confirmed ORCHID-417.' } }
      return new Response(JSON.stringify({ choices: [choice], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['context-handoff'], groups: ['session-context'], repetitions: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    const [run] = result.report.runs
    expect(run.status, run.detail).toBe('passed')
    expect(run.contextPreserved).toBe(true)
    expect(run.contextRequests?.map((item) => item.step)).toEqual([0, 1, 1])
    expect(run.contextRequests?.every((item) => item.recentTaskPresent && item.toolLinksValid && item.estimatedTokens <= item.inputLimit)).toBe(true)
    expect(result.report.summary[0].contextPreservationRate).toBe(1)
  })

  it('observes layered compression in the Context benchmark using its reduced budget', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const pageCalls = new Map<number, number>()
    let finalCalls = 0
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ content?: string | null }> }
      const first = body.messages[0]?.content ?? ''
      if (first.startsWith('Summarize ')) return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'Earlier result: PAGE-1-JUNIPER-162. Keep this marker for the final task.' } }], usage: { prompt_tokens: 100, completion_tokens: 15, total_tokens: 115 } }), { status: 200 })
      const user = [...body.messages].reverse().find((message) => message.content?.startsWith('Read context/page-') || message.content?.includes('Without using tools, what exact marker'))?.content ?? ''
      const page = user.includes('Without using tools') ? 0 : Number(/page-(\d+)\.txt/.exec(user)?.[1] ?? 0)
      let choice: unknown
      if (page) {
        const count = (pageCalls.get(page) ?? 0) + 1
        pageCalls.set(page, count)
        choice = count === 1
          ? { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: `read-${page}`, type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: `context/page-${page}.txt` }) } }] } }
          : { finish_reason: 'stop', message: { role: 'assistant', content: `PAGE-${page}-JUNIPER-${page}62` } }
      } else {
        finalCalls++
        choice = finalCalls === 1
          ? { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'write-final', type: 'function', function: { name: 'write_file', arguments: '{"path":"recalled-marker.txt","content":"PAGE-1-JUNIPER-162"}' } }] } }
          : { finish_reason: 'stop', message: { role: 'assistant', content: 'PAGE-1-JUNIPER-162' } }
      }
      return new Response(JSON.stringify({ choices: [choice], usage: { prompt_tokens: 100, completion_tokens: 15, total_tokens: 115 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['context-compression'], groups: ['session-context'], repetitions: 1, maxAgentRounds: 50, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    const [run] = result.report.runs
    expect(run.status, run.detail).toBe('passed')
    expect(run.contextCompressionObserved).toBe(true)
    expect(new Set(run.contextRequests?.flatMap((item) => item.summaryLevels))).toEqual(new Set(['L1', 'L2', 'L3']))
    expect(run.contextPreserved).toBe(true)
    expect(result.report.summary[0].contextCompressionRate).toBe(1)
  }, 20_000)

  it('measures MCP discovery, disconnect, reconnect, and rediscovery without a model stub', async () => {
    const root = await tempDir()
    const result = await runBenchmark({ tasks: ['mcp-recovery'], groups: ['full'], repetitions: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: vi.fn() as typeof fetch })
    expect(result.report.runs[0], result.report.runs[0].detail).toMatchObject({ status: 'passed', mcpDiscovered: true, mcpRecoverySucceeded: true, modelRequests: 0 })
  }, 15_000)

  it('discovers the relevant tool among exactly twenty MCP tools and uses its result', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    let request = 0
    let lookupName = ''
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      request++
      const body = JSON.parse(String(init?.body)) as { response_format?: unknown; tools?: Array<{ function?: { name?: string } }> }
      let choice: unknown
      if (body.response_format) choice = { finish_reason: 'stop', message: { role: 'assistant', content: '{"skills":[]}' } }
      else if (request === 2) {
        lookupName = body.tools?.map((tool) => tool.function?.name ?? '').find((name) => name.startsWith('mcp_benchmark_lookup_release_hint_')) ?? ''
        choice = { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'mcp-lookup', type: 'function', function: { name: lookupName, arguments: '{}' } }] } }
      } else if (request === 3) choice = { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'mcp-write', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ path: 'mcp-result.txt', content: 'MCP-CEDAR-931' }) } }] } }
      else choice = { finish_reason: 'stop', message: { role: 'assistant', content: 'The release hint is MCP-CEDAR-931.' } }
      return new Response(JSON.stringify({ choices: [choice], usage: { prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['mcp-discovery'], groups: ['full'], repetitions: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    expect(result.report.runs[0]).toMatchObject({ status: 'passed', mcpDiscovered: true, mcpToolCount: 20 })
    expect(lookupName).toContain('lookup_release_hint')
    expect(result.report.runs[0].toolTrace?.find((call) => call.name === lookupName)?.status).toBe('succeeded')
  }, 15_000)

  it('copies task fixtures into isolated workspaces and grades independently', async () => {
    const root = await tempDir()
    const workspace = path.join(root, 'workspace')
    const state = path.join(root, 'state')
    await mkdir(workspace, { recursive: true })
    await mkdir(state, { recursive: true })
    const task = benchmarkTasks.find((item) => item.id === 'locate-constant')!
    await prepareFixture(task, workspace, path.resolve('evaluation/fixtures'))
    const fixture = await readFile(path.join(workspace, 'src', 'limits.mjs'), 'utf8')
    expect(fixture).toContain('DEFAULT_TIMEOUT_MS = 2500')
    expect(await readFile(path.join(state, 'sessions.sqlite')).catch(() => '')).toBe('')
    await expect(task.steps[0].verify(workspace, 'DEFAULT_TIMEOUT_MS is 2500 ms')).resolves.toMatchObject({ passed: true })
    await expect(task.steps[0].verify(workspace, 'The timeout is 1000 ms')).resolves.toMatchObject({ passed: false })
  })

  it('summarizes only valid runs and reports usage only when complete', () => {
    const runs: EvaluationRun[] = [
      { taskId: 'locate', group: 'baseline', repetition: 1, status: 'passed', detail: '', durationMs: 1, modelRequests: 1, inputTokens: 100, outputTokens: 20, totalTokens: 120, usageComplete: true, toolCalls: 2, failedToolCalls: 0, toolDurationMs: 4 },
      { taskId: 'locate', group: 'baseline', repetition: 2, status: 'failed', detail: '', durationMs: 1, modelRequests: 1, inputTokens: null, outputTokens: null, totalTokens: null, usageComplete: false, toolCalls: 4, failedToolCalls: 1, toolDurationMs: 8 },
      { taskId: 'locate', group: 'baseline', repetition: 3, status: 'infrastructure_error', detail: '', durationMs: 1, modelRequests: 0, inputTokens: null, outputTokens: null, totalTokens: null, usageComplete: false, toolCalls: 0, failedToolCalls: 0, toolDurationMs: 0 },
    ]
    const [summary] = summarizeRuns(runs)
    expect(summary).toMatchObject({ validRuns: 2, infrastructureErrors: 1, completedRuns: 1, completionRate: 0.5, meanTotalTokens: 120, usageRuns: 1, meanTokensPerSuccessfulTask: 120, amortizedTokensPerCompletion: 120, completionWithin25k: 1 })
    expect(renderMarkdown([summary], runs)).toContain('50.0%')
    expect(renderMarkdown([summary], runs)).toContain('Full-minus-one attribution contrasts')
    expect(renderCsv(runs)).toContain('infrastructure_error')
  })

  it('reports observed Context preservation and layer use separately from task acceptance', () => {
    const [summary] = summarizeRuns([{
      taskId: 'long-context', suite: 'context', group: 'full', repetition: 1, status: 'failed', failureKind: 'model_execution', detail: 'cap', durationMs: 1,
      modelRequests: 2, modelRounds: 1, inputTokens: 100, outputTokens: 20, totalTokens: 120, usageComplete: true, toolCalls: 1, failedToolCalls: 0, toolDurationMs: 1,
      contextPreserved: true, contextCompressionObserved: true,
    }])
    expect(summary).toMatchObject({ completionRate: 0, contextPreservationRate: 1, contextCompressionRate: 1 })
  })

  it('derives plugin metrics from recorded outcomes and exports individual CSV fields', () => {
    const runs: EvaluationRun[] = [
      { taskId: 'skills-review', suite: 'skills', group: 'skills', repetition: 1, status: 'passed', detail: 'accepted', durationMs: 100, modelRequests: 3, modelRounds: 2, inputTokens: 40, outputTokens: 10, totalTokens: 50, usageComplete: true, toolCalls: 2, failedToolCalls: 0, toolDurationMs: 1, skillSelectionCorrect: true },
      { taskId: 'skills-review', suite: 'skills', group: 'skills', repetition: 2, status: 'failed', failureKind: 'acceptance', detail: 'rejected', durationMs: 200, modelRequests: 2, modelRounds: 1, inputTokens: null, outputTokens: null, totalTokens: null, usageComplete: false, toolCalls: 1, failedToolCalls: 0, toolDurationMs: 1, skillSelectionCorrect: false },
    ]
    const [item] = summarizeRuns(runs)
    expect(item).toMatchObject({ completionRate: 0.5, meanModelRounds: 1.5, meanLatencyMs: 150, skillSelectionAccuracy: 0.5, meanTotalTokens: 50 })
    expect(renderMarkdown([item], runs)).toContain('## Individual runs')
    expect(renderCsv(runs)).toContain('failureKind')
    expect(renderCsv(runs)).toContain('acceptance')
  })

  it('counts MCP discovery after task success and Context compression from observed request layers', () => {
    const common = { detail: '', durationMs: 1, modelRequests: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15, usageComplete: true, toolCalls: 1, failedToolCalls: 0, toolDurationMs: 1 }
    const runs: EvaluationRun[] = [
      { ...common, taskId: 'mcp-call', suite: 'mcp', group: 'full', repetition: 1, status: 'failed', mcpDiscovered: true },
      { ...common, taskId: 'mcp-call', suite: 'mcp', group: 'full', repetition: 2, status: 'passed', mcpDiscovered: true },
      { ...common, taskId: 'mcp-recovery', suite: 'mcp', group: 'full', repetition: 1, status: 'passed', mcpDiscovered: true, mcpRecoverySucceeded: true },
      { ...common, taskId: 'context-compression', suite: 'context', group: 'full', repetition: 1, status: 'failed', contextCompressionObserved: true },
      { ...common, taskId: 'context-compression', suite: 'context', group: 'full', repetition: 2, status: 'passed', contextCompressionObserved: true },
    ]
    const summary = summarizeRuns(runs)
    expect(summary.find((item) => item.taskId === 'mcp-call')?.mcpDiscoveryRate).toBe(0.5)
    expect(summary.find((item) => item.taskId === 'mcp-recovery')?.mcpDiscoveryRate).toBeNull()
    expect(summary.find((item) => item.taskId === 'context-compression')?.contextCompressionRate).toBe(1)
  })

  it('supports a baseline with task-local context and a session context ablation', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const skillsDir = path.join(root, 'skills')
    await mkdir(skillsDir, { recursive: true })
    const config = configSchema.parse({
      projectRoot: root,
      skillsDir,
      sessionDb: path.join(root, '.miniharness', 'sessions.sqlite'),
      plugins: ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'agent'],
    })
    const requests: Array<{ messages: Array<{ role: string; content?: string | null }> }> = []
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as typeof requests[number])
      const n = requests.length
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: n === 1 || n === 3 ? 'Earlier marker: FIR-526.' : 'Done.' } }] }), { status: 200 })
    }) as typeof fetch
    const baseline = await createRuntime(config, fakeFetch, undefined, { skills: false, sessionContext: false, contextEnhancements: false, recovery: false })
    try {
      const session = baseline.ctx.session.createSession()
      await baseline.ctx.agent.run('first benchmark task', session.id)
      await baseline.ctx.agent.run('second benchmark task', session.id)
      const localMessages = requests[1].messages
      expect(JSON.stringify(localMessages)).toContain('second benchmark task')
      expect(JSON.stringify(localMessages)).not.toContain('first benchmark task')
      expect(JSON.stringify(localMessages)).not.toContain('FIR-526')
    } finally { await baseline.dispose() }

    const contextual = await createRuntime(config, fakeFetch, undefined, { skills: false, sessionContext: true, contextEnhancements: true, recovery: true })
    try {
      const session = contextual.ctx.session.createSession()
      await contextual.ctx.agent.run('first context task', session.id)
      await contextual.ctx.agent.run('second context task', session.id)
      const contextMessages = requests.at(-1)!.messages
      expect(JSON.stringify(contextMessages)).toContain('first context task')
      expect(JSON.stringify(contextMessages)).toContain('FIR-526')
    } finally { await contextual.dispose() }
  })

  it('checks permission decisions in an isolated directory without running a shell command', async () => {
    await expect(runPermissionScenarios()).resolves.toMatchObject({ status: 'passed', falseAllows: 0, falseDenials: 0 })
  })

  it('keeps benchmark Skills outside the Agent root and reports selection failure separately', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    let completion = 0
    let sawDeniedRead = false
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { response_format?: unknown; messages: Array<{ content?: string }> }
      if (body.response_format) return new Response('selection unavailable', { status: 503 })
      completion++
      if (completion === 1) return new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'probe-1', function: { name: 'read_file', arguments: '{"path":"../state/skills/repo-analysis/SKILL.md"}' } }] } }] }), { status: 200 })
      if (completion === 2) sawDeniedRead = JSON.stringify(body.messages).includes('Path escapes the project root')
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'DEFAULT_TIMEOUT_MS is 2500 in src/limits.mjs.' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['locate-constant'], groups: ['baseline', 'skills'], repetitions: 1, outputDirectory: path.join(root, 'report'), fetchImpl: fakeFetch })
    const [baseline, skills] = result.report.runs
    expect(sawDeniedRead).toBe(true)
    expect(baseline).toMatchObject({ status: 'passed', skillSelectionRequests: 0, skillContextTokens: 0 })
    expect(skills).toMatchObject({ status: 'passed', skillSelectionFailures: 1, skillSelectionRequests: 1, skillContextTokens: 0 })
    expect(skills.skillTraces?.[0]).toMatchObject({ status: 'failed', selected: [], failure: expect.stringContaining('DeepSeek API 503') })
    expect(result.report.summary.find((item) => item.group === 'skills')?.skillSelectionFailures).toBe(1)
    expect(await readFile(path.join(root, 'report', 'runs.csv'), 'utf8')).toContain('skillSelectionFailures')
  })

  it('reports selected Skills, load status, selection usage, and injected context cost', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { response_format?: unknown }
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: body.response_format ? '{"skills":["repo-analysis"]}' : 'DEFAULT_TIMEOUT_MS is 2500 in src/limits.mjs.' } }],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['locate-constant'], groups: ['skills'], repetitions: 1, maxAgentRounds: 1, outputDirectory: path.join(root, 'report'), fetchImpl: fakeFetch })
    const [run] = result.report.runs
    expect(run.status).toBe('passed')
    expect(run).toMatchObject({ skillSelectionRequests: 1, skillSelectionTokens: 25, skillSelectionFailures: 0, modelRequests: 2, agentRequests: 1, skillRequests: 1, agentTokens: 25, skillTokens: 25, capReason: undefined })
    expect(run.skillContextTokens).toBeGreaterThan(0)
    expect(run.skillTraces?.[0]).toMatchObject({ selected: ['repo-analysis'], loads: [{ name: 'repo-analysis', status: 'loaded' }], selectionUsage: { totalTokens: 25 }, injectedTurns: 1 })
    expect(JSON.parse(await readFile(path.join(root, 'report', 'results.json'), 'utf8')).runs[0].skillTraces[0].loads[0].status).toBe('loaded')
  })

  it('keeps selection and summary requests outside the Agent-round cap and separates their token costs', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { response_format?: unknown; messages: Array<{ content?: string }> }
      const selection = body.response_format !== undefined
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: selection ? '{"skills":[]}' : 'DEFAULT_TIMEOUT_MS is 2500 in src/limits.mjs.' } }], usage: { prompt_tokens: selection ? 11 : 13, completion_tokens: 2, total_tokens: selection ? 13 : 15 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['locate-constant'], groups: ['skills'], repetitions: 1, maxAgentRounds: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    expect(result.report.runs[0]).toMatchObject({ status: 'passed', agentRequests: 1, skillRequests: 1, summaryRequests: 0, modelRequests: 2, agentTokens: 15, skillTokens: 13, capReason: undefined })
  })

  it('compares recovery tasks across groups and records the one-time side effect', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const replies = [
      { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'baseline-interrupt', type: 'function', function: { name: 'benchmark_interrupt', arguments: '{}' } }] } },
      { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'context-interrupt', type: 'function', function: { name: 'benchmark_interrupt', arguments: '{}' } }] } },
      { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'context-write', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ path: 'recovered.txt', content: 'PARTIAL-STATE-OK' }) } }] } },
      { finish_reason: 'stop', message: { role: 'assistant', content: 'Recovered PARTIAL-STATE-OK once.' } },
    ]
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify({ choices: [replies.shift()], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }), { status: 200 })) as typeof fetch
    const result = await runBenchmark({ tasks: ['candidate-recovery-partial-write'], groups: ['baseline', 'session-context'], repetitions: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    expect(result.report.runs.map((run) => run.status)).toEqual(['failed', 'passed'])
    expect(result.report.runs[0]).toMatchObject({ recoveryEligible: false, unknownCallsReplayed: false })
    expect(result.report.runs[1]).toMatchObject({ suite: 'common', recoveryEligible: true, recoverySucceeded: true, unknownCallsReplayed: false })
    expect(result.report.runs[1].toolTrace?.filter((call) => call.name === 'benchmark_interrupt')).toHaveLength(1)
  })

  it('injects an in-flight tool interruption, resumes explicitly, and never replays the unknown call', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const replies = [
      { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'interrupt-1', type: 'function', function: { name: 'benchmark_interrupt', arguments: '{}' } }] } },
      { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'write-1', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ path: 'recovered.txt', content: 'RECOVERED' }) } }] } },
      { finish_reason: 'stop', message: { role: 'assistant', content: 'Recovered successfully.' } },
    ]
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify({ choices: [replies.shift()], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }), { status: 200 })) as typeof fetch
    const result = await runBenchmark({
      tasks: ['fault-recovery'],
      groups: ['session-context'],
      repetitions: 1,
      outputDirectory: path.join(root, 'reports'),
      fetchImpl: fakeFetch,
    })
    expect(result.report.runs).toHaveLength(1)
    expect(result.report.runs[0].status, result.report.runs[0].detail).toBe('passed')
    expect(result.report.runs[0]).toMatchObject({ taskId: 'fault-recovery', recoveryEligible: true, recoverySucceeded: true, unknownCallsReplayed: false, totalTokens: 75 })
    expect(fakeFetch).toHaveBeenCalledTimes(3)
    expect(await readFile(path.join(root, 'reports', 'results.json'), 'utf8')).toContain('fault-recovery')
    expect(await readFile(path.join(root, 'reports', 'permission.json'), 'utf8')).toContain('falseAllows')
  })

  it('records the Prompt resume stage and pinned version in the Full Harness recovery scenario', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-eval-key'
    const root = await tempDir()
    const replies = [
      { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'interrupt-1', type: 'function', function: { name: 'benchmark_interrupt', arguments: '{}' } }] } },
      { finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'write-1', type: 'function', function: { name: 'write_file', arguments: '{"path":"recovered.txt","content":"RECOVERED"}' } }] } },
      { finish_reason: 'stop', message: { role: 'assistant', content: 'Recovered successfully.' } },
    ]
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { response_format?: unknown }
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"skills":[]}' }, ...(body.response_format ? {} : replies.shift()) }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }), { status: 200 })
    }) as typeof fetch
    const result = await runBenchmark({ tasks: ['fault-recovery'], groups: ['full'], repetitions: 1, outputDirectory: path.join(root, 'reports'), fetchImpl: fakeFetch })
    const [run] = result.report.runs
    expect(run.status, run.detail).toBe('passed')
    expect(run.promptTraces?.map((trace) => trace.stage)).toEqual(['initial', 'resume', 'tool_followup'])
    expect(run.promptStageCompliant).toBe(true)
    expect(run.promptTraces?.[0].templates.map((item) => item.id)).toContain('task/benchmark-initial@2')
  })
})
