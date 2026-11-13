import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import os from 'node:os'
import path from 'node:path'
import { TaskPausedError } from '../plugins/agent.js'
import { createRuntime } from '../runtime.js'
import { configSchema } from '../config.js'
import { estimateTokens } from '../context.js'
import type { AgentCapabilities, ApprovalHandler, ChatMessage, ContextCheckpoint, PromptTrace, SkillTrace, ToolDefinition, ToolRegistration } from '../types.js'
import { benchmarkTasks, benchmarkVersion, candidateCommonTasks, commonBenchmarkTasks, prepareFixture } from './benchmark.js'
import { renderCsv, renderMarkdown, summarizeRuns, type ContextRequestObservation, type EvaluationGroup, type EvaluationRun } from './metrics.js'

export interface BenchmarkOptions {
  tasks?: string[]
  groups?: EvaluationGroup[]
  repetitions?: number
  maxAgentRounds?: number
  timeoutMs?: number
  outputDirectory?: string
  fetchImpl?: typeof fetch
}

const groups: EvaluationGroup[] = ['baseline', 'skills', 'session-context', 'prompt', 'full', 'full-no-skills', 'full-no-prompt', 'full-no-context']
const capabilities: Record<EvaluationGroup, AgentCapabilities> = {
  baseline: { skills: false, sessionContext: false, contextEnhancements: false, recovery: false },
  skills: { skills: true, sessionContext: false, contextEnhancements: false, recovery: false },
  'session-context': { skills: false, sessionContext: true, contextEnhancements: true, recovery: true },
  prompt: { skills: false, sessionContext: false, contextEnhancements: false, recovery: false },
  full: { skills: true, sessionContext: true, contextEnhancements: true, recovery: true },
  'full-no-skills': { skills: false, sessionContext: true, contextEnhancements: true, recovery: true },
  'full-no-prompt': { skills: true, sessionContext: true, contextEnhancements: true, recovery: true },
  'full-no-context': { skills: true, sessionContext: false, contextEnhancements: false, recovery: true },
}
const pluginSets: Record<EvaluationGroup, string[]> = {
  baseline: ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'agent'],
  skills: ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'agent'],
  'session-context': ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'agent'],
  prompt: ['logger', 'hooks', 'permission', 'llm', 'tools', 'skills', 'session', 'prompt', 'agent'],
  full: ['logger', 'hooks', 'permission', 'llm', 'tools', 'mcp', 'skills', 'session', 'prompt', 'agent'],
  'full-no-skills': ['logger', 'hooks', 'permission', 'llm', 'tools', 'mcp', 'skills', 'session', 'prompt', 'agent'],
  'full-no-prompt': ['logger', 'hooks', 'permission', 'llm', 'tools', 'mcp', 'skills', 'session', 'agent'],
  'full-no-context': ['logger', 'hooks', 'permission', 'llm', 'tools', 'mcp', 'skills', 'session', 'prompt', 'agent'],
}

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
type UsageStats = { requests: number; agentRequests: number; skillRequests: number; summaryRequests: number; input: number; output: number; total: number; agentInput: number; agentOutput: number; agentTotal: number; skillInput: number; skillOutput: number; skillTotal: number; summaryInput: number; summaryOutput: number; summaryTotal: number; complete: boolean; capReason?: string }
const MAX_AGENT_ROUNDS = 60
const MAX_TOTAL_REQUESTS = 120
const MAX_TOTAL_TOKENS = 250_000
const runFile = promisify(execFile)

export function missingUsageRequestCapReached(requests: number, usageComplete: boolean) {
  return !usageComplete && requests >= MAX_TOTAL_REQUESTS
}

function skillSelectionTokens(traces: SkillTrace[]): number | null {
  const requests = traces.filter((trace) => trace.selectionRequests > 0)
  return requests.length && requests.every((trace) => trace.selectionUsage.totalTokens !== null)
    ? requests.reduce((sum, trace) => sum + trace.selectionUsage.totalTokens!, 0) : null
}

export function skillSelectionMatchesExpected(expected: string[], traces: Array<{ selected: string[] }>) {
  const selected = new Set(traces.flatMap((trace) => trace.selected))
  return expected.every((name) => selected.has(name))
}

export function evaluateSkillSelection(expected: string[] | undefined, enabled: boolean, traces: Array<{ selected: string[] }>): boolean | null {
  return expected && enabled ? skillSelectionMatchesExpected(expected, traces) : null
}

function toolTraceForTask(runtime: Awaited<ReturnType<typeof createRuntime>>, taskId: string): NonNullable<EvaluationRun['toolTrace']> {
  return runtime.ctx.session.listCalls(taskId).map((call) => ({
    name: call.name,
    arguments: call.arguments,
    status: call.status,
    result: call.result?.slice(0, 8_000) ?? null,
    attempts: runtime.ctx.session.listAttempts(call.id).map(({ status, errorCode, error, approval }) => ({ status, errorCode, error, approval })),
  }))
}

function inspectContextRequest(messages: ChatMessage[], tools: ToolDefinition[], step: number, task: string, inputLimit: number): ContextRequestObservation {
  const summaryLevels = (['L1', 'L2', 'L3'] as const).filter((level) => messages.some((message) => message.content?.startsWith(`Summary of earlier conversation (${level};`)))
  const resultIds = new Set(messages.filter((message) => message.role === 'tool').map((message) => message.tool_call_id))
  return {
    step,
    estimatedTokens: messages.reduce((sum, message) => sum + estimateTokens(message), 0) + estimateTokens(tools),
    inputLimit,
    summaryLevels,
    recentTaskPresent: messages.some((message) => message.role === 'user' && message.content?.includes(task)),
    toolLinksValid: messages.every((message) => message.role !== 'assistant' || !message.tool_calls?.length || message.tool_calls.every((call) => resultIds.has(call.id))),
  }
}

function promptStagesValid(traces: PromptTrace[], resumed = false): boolean {
  return traces.length > 0 && traces.every((trace) => {
    const expected = trace.stage === 'initial' ? 'task/benchmark-initial@2' : 'task/benchmark-followup@1'
    const correctStage = trace.stage === (trace.iteration === 1 ? 'initial' : resumed && trace.iteration === 2 ? 'resume' : 'tool_followup')
    return trace.status === 'completed' && correctStage
      && trace.templates.some((item) => item.id === expected && item.digest.length === 64)
      && trace.messages.some((message) => message.role === 'user' && message.content?.includes(trace.variables.task))
  })
}

function instrumentFetch(usage: UsageStats, fetchImpl: typeof fetch = fetch, onAgentRequest?: (messages: ChatMessage[]) => void, maxAgentRounds = MAX_AGENT_ROUNDS): typeof fetch {
  return async (input, init) => {
    if (missingUsageRequestCapReached(usage.requests, usage.complete)) {
      usage.capReason = 'missing-usage-request-guard'
      throw new Error(`Evaluation missing-usage request guard exceeded (${MAX_TOTAL_REQUESTS})`)
    }
    usage.requests++
    let requestKind: 'agent' | 'skill' | 'summary' = 'agent'
    let body = init?.body
    if (typeof body === 'string') {
      const parsed = JSON.parse(body) as Record<string, unknown>
      parsed.temperature = 0
      if (Array.isArray(parsed.messages)) {
        const messages = parsed.messages as ChatMessage[]
        const system = messages.find((message) => message.role === 'system')?.content ?? ''
        if (/summarize/i.test(system)) {
          requestKind = 'summary'
          usage.summaryRequests++
        } else if (/choose.*skill|select.*skill/i.test(system)) {
          requestKind = 'skill'
          usage.skillRequests++
        } else {
          usage.agentRequests++
          if (onAgentRequest) onAgentRequest(messages)
          if (usage.agentRequests > maxAgentRounds) { usage.capReason = 'agent-round-cap'; throw new Error(`Evaluation Agent-round cap exceeded (${maxAgentRounds})`) }
        }
      }
      body = JSON.stringify(parsed)
    }
    const response = await fetchImpl(input, { ...init, body })
    const data = await response.clone().json().catch(() => undefined) as { usage?: Usage } | undefined
    const item = data?.usage
    if (item && typeof item.prompt_tokens === 'number' && typeof item.completion_tokens === 'number' && typeof item.total_tokens === 'number') {
      usage.input += item.prompt_tokens
      usage.output += item.completion_tokens
      usage.total += item.total_tokens
      if (requestKind === 'agent') { usage.agentInput += item.prompt_tokens; usage.agentOutput += item.completion_tokens; usage.agentTotal += item.total_tokens }
      else if (requestKind === 'skill') { usage.skillInput += item.prompt_tokens; usage.skillOutput += item.completion_tokens; usage.skillTotal += item.total_tokens }
      else { usage.summaryInput += item.prompt_tokens; usage.summaryOutput += item.completion_tokens; usage.summaryTotal += item.total_tokens }
      if (usage.total > MAX_TOTAL_TOKENS) { usage.capReason = 'token-safety-cap'; throw new Error(`Evaluation token safety cap exceeded (${MAX_TOTAL_TOKENS})`) }
    } else usage.complete = false
    return response
  }
}

function isInfrastructureFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /DEEPSEEK_API_KEY|DeepSeek API|request timed out|case timed out|Failed to initialize session|MCP server|MCP fixture|MCP disconnect tool|fetch failed|ECONN|ENOTFOUND|socket/i.test(message)
}

function passVerificationError(error: unknown) {
  return { passed: false, detail: `Acceptance program failed: ${error instanceof Error ? error.message : String(error)}` }
}

function createConfig(workspace: string, stateRoot: string, taskId: string, group: EvaluationGroup, maxIterations: number) {
  const task = benchmarkTasks.find((item) => item.id === taskId)
  const mcpTask = task?.suite === 'mcp'
  const compressionTask = taskId === 'context-compression'
  const contextBudget = evaluationContextSettings(taskId, task?.contextBudget)
  const contextLayers = compressionTask
    ? { L0: { initial: 900, max: 1600 }, L1: { initial: 180, max: 300 }, L2: { initial: 100, max: 180 }, L3: { initial: 128, max: 256 } }
    : task?.suite === 'context' || task?.candidateFamily === 'context'
      ? { L0: { initial: 900, max: 1600 }, L1: { initial: 500, max: 900 }, L2: { initial: 250, max: 500 }, L3: { initial: 200, max: 400 } }
      : undefined
  return configSchema.parse({
    projectRoot: workspace,
    skillsDir: path.join(stateRoot, 'skills'),
    promptsDir: path.join(stateRoot, 'prompts'),
    sessionDb: path.join(stateRoot, 'sessions.sqlite'),
    maxIterations,
    maxTaskIterations: maxIterations,
    toolRetries: 0,
    contextInputTokens: contextBudget.contextWindowTokens,
    contextOutputReserve: contextBudget.outputReserve,
    context: {
      softThreshold: compressionTask ? 0.6 : 0.85,
      ...(contextLayers ? { layers: contextLayers } : {}),
    },
    plugins: pluginSets[group],
    prompts: { versions: { 'task/benchmark-initial': '2' } },
    permissions: { allow: ['write_file', 'benchmark_interrupt'], deny: [], defaultWrite: 'deny', approvalTimeoutMs: 1000 },
    mcp: {
      servers: mcpTask && group.startsWith('full') ? [{
        id: 'benchmark', transport: 'stdio', command: process.execPath,
        args: [path.resolve('scripts/fixtures/mcp-benchmark-server.mjs'), ...(taskId === 'mcp-call' ? ['echo'] : [])], cwd: workspace, permission: 'read',
      }] : [],
      connectTimeoutMs: 5_000,
      reconnectProbeMs: 60_000,
    },
  })
}

export function evaluationContextSettings(taskId: string, requestedInputTokens?: number) {
  const outputReserve = taskId === 'context-compression' ? 512 : 2_048
  const contextWindowTokens = requestedInputTokens === undefined ? 16_000 : requestedInputTokens + outputReserve
  return { hardInputTokens: contextWindowTokens - outputReserve, outputReserve, contextWindowTokens }
}

function safeTestPath(workspace: string, relative: unknown): string | undefined {
  if (typeof relative !== 'string' || !relative.endsWith('.test.mjs') || relative.includes('\0') || /^[A-Za-z]:/.test(relative) || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) return undefined
  const root = path.resolve(workspace)
  const target = path.resolve(root, relative)
  return target.startsWith(`${root}${path.sep}`) ? target : undefined
}

async function safeTestFile(workspace: string, relative: unknown): Promise<string | undefined> {
  const lexical = safeTestPath(workspace, relative)
  if (!lexical) return undefined
  try {
    const [root, target, file] = await Promise.all([realpath(workspace), realpath(lexical), lstat(lexical)])
    return file.isFile() && !file.isSymbolicLink() && target.startsWith(`${root}${path.sep}`) ? target : undefined
  } catch { return undefined }
}

function restrictedTestTool(workspace: string): ToolRegistration {
  return {
    definition: {
      name: 'run_node_tests',
      description: 'Run a .test.mjs file with node:test inside this isolated benchmark workspace. Use this for test commands; general shell commands still require interactive approval.',
      permission: 'dangerous',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Workspace-relative path ending in .test.mjs' } }, required: ['path'], additionalProperties: false },
    },
    validate(args) {
      if (!args || typeof args !== 'object' || !safeTestPath(workspace, (args as Record<string, unknown>).path)) throw new Error('Test path must be a .test.mjs file inside the isolated workspace')
      return { path: (args as Record<string, unknown>).path as string }
    },
    async execute(args) {
      const target = await safeTestFile(workspace, args.path)
      if (!target) throw new Error('Test path is outside the isolated workspace')
      const env = { SystemRoot: process.env.SystemRoot ?? '', PATH: path.dirname(process.execPath) }
      const { stdout, stderr } = await runFile(process.execPath, ['--permission', `--allow-fs-read=${path.resolve(workspace)}`, '--test-isolation=none', '--test', path.relative(workspace, target)], {
        cwd: workspace, timeout: 60_000, maxBuffer: 256_000, windowsHide: true, env,
      })
      return { content: [{ type: 'text', text: `${stdout}${stderr}`.slice(0, 32_000) }], isError: false }
    },
  }
}

function benchmarkApproval(workspace: string): ApprovalHandler {
  return async ({ toolName, args }) => toolName === 'run_node_tests' && Boolean(await safeTestFile(workspace, args.path))
}

async function runOne(taskId: string, group: EvaluationGroup, repetition: number, options: Required<Pick<BenchmarkOptions, 'maxAgentRounds' | 'timeoutMs'>>, fixtureRoot: string, fetchImpl: typeof fetch = fetch): Promise<EvaluationRun> {
  const task = benchmarkTasks.find((item) => item.id === taskId)
  if (!task) throw new Error(`Unknown benchmark task: ${taskId}`)
  const started = Date.now()
  const usage: UsageStats = { requests: 0, agentRequests: 0, skillRequests: 0, summaryRequests: 0, input: 0, output: 0, total: 0, agentInput: 0, agentOutput: 0, agentTotal: 0, skillInput: 0, skillOutput: 0, skillTotal: 0, summaryInput: 0, summaryOutput: 0, summaryTotal: 0, complete: true }
  const temp = await mkdtemp(path.join(os.tmpdir(), 'miniharness-benchmark-'))
  const workspace = path.join(temp, 'workspace')
  const stateRoot = path.join(temp, 'state')
  await mkdir(workspace, { recursive: true })
  await mkdir(stateRoot, { recursive: true })
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined
  let status: EvaluationRun['status'] = 'failed'
  let detail = ''
  let toolCalls = 0
  let modelRounds = 0
  let failedToolCalls = 0
  let toolDurationMs = 0
  let skillTraces: SkillTrace[] = []
  let toolTrace: NonNullable<EvaluationRun['toolTrace']> = []
  const promptTraces: PromptTrace[] = []
  let contextCheckpoints: ContextCheckpoint[] = []
  const contextTimeline: Array<{ step: number; checkpoints: ContextCheckpoint[] }> = []
  const contextRequests: ContextRequestObservation[] = []
  const stepResults: Array<{ index: number; passed: boolean; detail: string }> = []
  let failureKind: EvaluationRun['failureKind']
  let mcpDiscovered: boolean | null = null
  let mcpToolCount: number | null = null
  let sessionId: string | undefined
  let currentStep = -1
  const timer = new AbortController()
  const timeout = setTimeout(() => { usage.capReason = 'time-limit'; timer.abort(new Error(`Evaluation case timed out after ${options.timeoutMs} ms`)) }, options.timeoutMs)
  try {
    await prepareFixture(task, workspace, fixtureRoot)
    if (capabilities[group].skills) await cp(path.resolve('skills'), path.join(stateRoot, 'skills'), { recursive: true, force: true })
    if (pluginSets[group].includes('prompt')) await cp(path.resolve('evaluation/prompts'), path.join(stateRoot, 'prompts'), { recursive: true, force: true })
    const config = createConfig(workspace, stateRoot, taskId, group, options.maxAgentRounds)
    runtime = await createRuntime(config, instrumentFetch(usage, fetchImpl, (messages) => {
      if (currentStep < 0) return
      contextRequests.push(inspectContextRequest(messages, runtime?.ctx.tools.definitions() ?? [], currentStep, task.steps[currentStep].prompt, config.contextInputTokens - config.contextOutputReserve))
    }, options.maxAgentRounds), benchmarkApproval(workspace), capabilities[group])
    runtime.ctx.tools.replaceSource('benchmark-restricted-tests', [restrictedTestTool(workspace)])
    if (task.suite === 'mcp') {
      const mcpTools = runtime.ctx.tools.definitions().filter((tool) => tool.name.startsWith('mcp_'))
      mcpToolCount = mcpTools.length
      mcpDiscovered = mcpTools.some((tool) => tool.name.startsWith('mcp_benchmark_lookup_release_hint_'))
    }
    if (task.suite === 'mcp' && !mcpDiscovered) {
      throw new Error('MCP fixture did not publish the expected lookup tool')
    }
    const session = runtime.ctx.session.createSession()
    sessionId = session.id
    const details: string[] = []
    for (const [index, step] of task.steps.entries()) {
      currentStep = index
      if (timer.signal.aborted) throw timer.signal.reason
      const extra: ToolRegistration[] = step.extraTools?.(workspace) ?? []
      runtime.ctx.tools.replaceSource(`benchmark-step-${index}`, extra)
      runtime.ctx.tools.setToolsEnabled(step.blockedTools ?? [], false)
      let answer: string
      try {
        const onEvent = (event: { type: string }) => { if (event.type === 'model.request') modelRounds++ }
        let pausedTaskId: string | undefined
        let resumes = 0
        while (true) {
          try {
            answer = pausedTaskId
              ? await runtime.ctx.agent.resume(pausedTaskId, onEvent, timer.signal)
              : await runtime.ctx.agent.run(step.prompt, session.id, onEvent, timer.signal)
            break
          } catch (error) {
            if (!(error instanceof TaskPausedError) || !capabilities[group].recovery || resumes >= 4) throw error
            const paused = runtime.ctx.session.listTasks(session.id).at(-1)
            if (!paused) throw error
            pausedTaskId = paused.id
            resumes++
          }
        }
      } finally { runtime.ctx.tools.setToolsEnabled(step.blockedTools ?? [], true) }
      contextTimeline.push({ step: index, checkpoints: runtime.ctx.session.listContextCheckpoints(session.id) })
      const taskRecord = runtime.ctx.session.listTasks(session.id).at(-1)
      const calledTools = taskRecord ? runtime.ctx.session.listCalls(taskRecord.id).map((call) => call.name) : []
      const verdict = await step.verify(workspace, answer, calledTools).catch((error) => passVerificationError(error))
      stepResults.push({ index, ...verdict })
      details.push(verdict.detail)
      if (!verdict.passed) {
        status = 'failed'
        failureKind = 'acceptance'
        detail = verdict.detail
        break
      }
      status = 'passed'
    }
    if (!detail) detail = details.join(' ')
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error)
    if (/maximum total of \d+ model iterations/.test(detail)) usage.capReason = 'agent-round-cap'
    status = isInfrastructureFailure(error) ? 'infrastructure_error' : 'failed'
    failureKind = status === 'infrastructure_error' ? 'infrastructure' : 'model_execution'
  } finally {
    clearTimeout(timeout)
    if (runtime && sessionId) {
      try {
        for (const record of runtime.ctx.session.listTasks(sessionId)) {
          const trace = runtime.ctx.session.getSkillTrace(record.id)
          if (trace) skillTraces.push(trace)
          promptTraces.push(...runtime.ctx.session.listPromptTraces(record.id))
          const calls = runtime.ctx.session.listCalls(record.id)
          toolTrace.push(...toolTraceForTask(runtime, record.id))
          toolCalls += calls.length
          failedToolCalls += calls.reduce((sum, call) => sum + runtime!.ctx.session.listAttempts(call.id).filter((attempt) => attempt.status === 'failed').length, 0)
          toolDurationMs += calls.reduce((sum, call) => sum + runtime!.ctx.session.listAttempts(call.id).reduce((attemptSum, attempt) => attemptSum + (attempt.durationMs ?? 0), 0), 0)
        }
        contextCheckpoints = runtime.ctx.session.listContextCheckpoints(sessionId)
      } catch { /* The primary run error is already recorded. */ }
    }
    try { await runtime?.dispose() } catch (error) {
      if (status === 'passed') { status = 'infrastructure_error'; failureKind = 'infrastructure'; detail = `Runtime cleanup failed: ${(error as Error).message}` }
    }
    await rm(temp, { recursive: true, force: true })
  }
  return {
    taskId, group, repetition, status, detail, durationMs: Date.now() - started,
    modelRequests: usage.requests, modelRounds,
    agentRequests: usage.agentRequests, skillRequests: usage.skillRequests, summaryRequests: usage.summaryRequests, capReason: usage.capReason,
    agentTokens: usage.agentTotal, skillTokens: usage.skillTotal, summaryTokens: usage.summaryTotal,
    inputTokens: usage.complete ? usage.input : null,
    outputTokens: usage.complete ? usage.output : null,
    totalTokens: usage.complete ? usage.total : null,
    usageComplete: usage.complete && usage.requests > 0,
    toolCalls, failedToolCalls, toolDurationMs,
    skillTraces,
    skillSelectionFailures: skillTraces.filter((trace) => trace.status === 'failed').length,
    skillSelectionRequests: skillTraces.reduce((sum, trace) => sum + trace.selectionRequests, 0),
    skillSelectionDurationMs: skillTraces.reduce((sum, trace) => sum + trace.selectionDurationMs, 0),
    skillSelectionTokens: skillSelectionTokens(skillTraces),
    skillContextTokens: skillTraces.reduce((sum, trace) => sum + trace.contextTokens, 0),
    suite: task.suite ?? 'common', category: task.category, failureKind, stepResults, toolTrace,
    expectedSkills: task.expectedSkills,
    skillSelectionCorrect: evaluateSkillSelection(task.expectedSkills, capabilities[group].skills, skillTraces),
    promptTraces, promptStageCompliant: pluginSets[group].includes('prompt') ? promptStagesValid(promptTraces) : null,
    contextCheckpoints, contextTimeline, contextRequests,
    contextPreserved: task.suite === 'context' || task.candidateFamily === 'context' ? contextRequests.length > 0 && contextRequests.every((item) => item.recentTaskPresent && item.toolLinksValid && item.estimatedTokens <= item.inputLimit) : null,
    contextCompressionObserved: taskId === 'context-compression' ? (['L1', 'L2', 'L3'] as const).every((level) => contextRequests.some((item) => item.summaryLevels.includes(level))) : ['candidate-context-page17-recall', 'candidate-context-long-history-decisions'].includes(taskId) ? (['L2', 'L3'] as const).every((level) => contextRequests.some((item) => item.summaryLevels.includes(level))) : null,
    mcpDiscovered,
    mcpToolCount,
  }
}

async function runRecoveryOne(group: EvaluationGroup, repetition: number, options: Required<Pick<BenchmarkOptions, 'maxAgentRounds' | 'timeoutMs'>>, fetchImpl: typeof fetch = fetch, taskId = 'fault-recovery'): Promise<EvaluationRun> {
  const started = Date.now()
  const usage: UsageStats = { requests: 0, agentRequests: 0, skillRequests: 0, summaryRequests: 0, input: 0, output: 0, total: 0, agentInput: 0, agentOutput: 0, agentTotal: 0, skillInput: 0, skillOutput: 0, skillTotal: 0, summaryInput: 0, summaryOutput: 0, summaryTotal: 0, complete: true }
  const temp = await mkdtemp(path.join(os.tmpdir(), 'miniharness-recovery-'))
  const workspace = path.join(temp, 'workspace')
  const stateRoot = path.join(temp, 'state')
  await mkdir(workspace, { recursive: true })
  await mkdir(stateRoot, { recursive: true })
  if (capabilities[group].skills) await cp(path.resolve('skills'), path.join(stateRoot, 'skills'), { recursive: true, force: true })
  if (pluginSets[group].includes('prompt')) await cp(path.resolve('evaluation/prompts'), path.join(stateRoot, 'prompts'), { recursive: true, force: true })
  const config = createConfig(workspace, stateRoot, 'cross-task-handoff', group, 8)
  const abort = new AbortController()
  const timeout = setTimeout(() => { usage.capReason = 'time-limit'; abort.abort(new Error(`Evaluation case timed out after ${options.timeoutMs} ms`)) }, options.timeoutMs)
  let resumedTimer: ReturnType<typeof setTimeout> | undefined
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined
  let taskKey = ''
  let effects = 0
  let status: EvaluationRun['status'] = 'failed'
  let detail = ''
  let replayed = false
  let toolCalls = 0
  let modelRounds = 0
  let failedToolCalls = 0
  let toolDurationMs = 0
  let skillTraces: SkillTrace[] = []
  let promptTraces: PromptTrace[] = []
  let toolTrace: NonNullable<EvaluationRun['toolTrace']> = []
  const scenario = taskId === 'candidate-recovery-partial-write'
    ? { effectFile: 'partial-write.txt', outputFile: 'recovered.txt', value: 'PARTIAL-STATE-OK' }
    : taskId === 'candidate-recovery-idempotent-retry'
      ? { effectFile: 'side-effect-count.txt', outputFile: 'idempotent.txt', value: 'COMMITTED-ONCE' }
      : taskId === 'candidate-recovery-sequential-checkpoint'
        ? { effectFile: 'checkpoint.txt', outputFile: 'checkpoint-final.txt', value: 'CHECKPOINT-73' }
        : { effectFile: 'effect-marker.txt', outputFile: 'recovered.txt', value: 'RECOVERED' }
  const registerInterruptTool = (controller: AbortController): ToolRegistration[] => [{
    definition: { name: 'benchmark_interrupt', description: 'A fault injection tool that persists one file effect and then simulates a process interruption. Use it exactly once when asked.', permission: 'write', parameters: { type: 'object', additionalProperties: false } },
    validate: () => ({}),
    execute: async () => {
      effects++
      await writeFile(path.join(workspace, scenario.effectFile), `${scenario.value}:${effects}`, 'utf8')
      if (effects === 1) setTimeout(() => controller.abort(new Error('Injected interruption during tool execution')), 25)
      return new Promise(() => {})
    },
  }]
  try {
    runtime = await createRuntime(config, instrumentFetch(usage, fetchImpl, undefined, options.maxAgentRounds), benchmarkApproval(workspace), capabilities[group])
    runtime.ctx.tools.replaceSource('benchmark-restricted-tests', [restrictedTestTool(workspace)])
    runtime.ctx.tools.replaceSource('benchmark-interrupt', registerInterruptTool(abort))
    const session = runtime.ctx.session.createSession()
    const prompt = `Call benchmark_interrupt exactly once. The process will stop while it is running, after ${scenario.effectFile} may already exist. On explicit resume, never call benchmark_interrupt again. Inspect ${scenario.effectFile}; if it exists with ${scenario.value}:1, write ${scenario.outputFile} containing ${scenario.value} and finish.`
    await runtime.ctx.agent.run(prompt, session.id, (event) => { if (event.type === 'model.request') modelRounds++ }, abort.signal).catch(() => undefined)
    const tasks = runtime.ctx.session.listTasks(session.id)
    const task = tasks.at(-1)
    if (!task || task.status !== 'interrupted' || effects !== 1) throw new Error(`Fault injection did not interrupt an active tool exactly once (status=${task?.status ?? 'missing'}, effects=${effects})`)
    taskKey = task.id
    const calls = runtime.ctx.session.listCalls(task.id)
    if (!calls.some((call) => call.status === 'unknown')) throw new Error('Interrupted tool call was not persisted with unknown status')
    await runtime.dispose()
    runtime = undefined
    const resumedAbort = new AbortController()
  resumedTimer = setTimeout(() => { usage.capReason = 'time-limit'; resumedAbort.abort(new Error(`Evaluation recovery timed out after ${options.timeoutMs} ms`)) }, options.timeoutMs)
    runtime = await createRuntime(config, instrumentFetch(usage, fetchImpl, undefined, options.maxAgentRounds), benchmarkApproval(workspace), capabilities[group])
    runtime.ctx.tools.replaceSource('benchmark-restricted-tests', [restrictedTestTool(workspace)])
    runtime.ctx.tools.replaceSource('benchmark-interrupt', registerInterruptTool(resumedAbort))
    const answer = await runtime.ctx.agent.resume(task.id, (event) => { if (event.type === 'model.request') modelRounds++ }, resumedAbort.signal)
    const recovered = await readFile(path.join(workspace, scenario.outputFile), 'utf8').catch(() => '')
    replayed = effects !== 1
    status = recovered.trim() === scenario.value && answer.toLowerCase().includes(scenario.value.toLowerCase()) && !replayed ? 'passed' : 'failed'
    detail = status === 'passed' ? 'Interrupted tool was marked unknown, explicitly resumed, and not replayed.' : `Recovery output or no-replay check failed (effects=${effects}).`
    const records = runtime.ctx.session.listCalls(taskKey)
    toolTrace = toolTraceForTask(runtime, taskKey)
    const trace = runtime.ctx.session.getSkillTrace(taskKey)
    if (trace) skillTraces = [trace]
    promptTraces = runtime.ctx.session.listPromptTraces(taskKey)
    toolCalls = records.length
    failedToolCalls = records.reduce((sum, call) => sum + runtime!.ctx.session.listAttempts(call.id).filter((attempt) => attempt.status === 'failed').length, 0)
    toolDurationMs = records.reduce((sum, call) => sum + runtime!.ctx.session.listAttempts(call.id).reduce((attemptSum, attempt) => attemptSum + (attempt.durationMs ?? 0), 0), 0)
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error)
    status = isInfrastructureFailure(error) ? 'infrastructure_error' : 'failed'
    replayed = effects > 1
  } finally {
    clearTimeout(timeout)
    if (resumedTimer) clearTimeout(resumedTimer)
    if (runtime && taskKey && !skillTraces.length) {
      try { const trace = runtime.ctx.session.getSkillTrace(taskKey); if (trace) skillTraces = [trace] } catch { /* Keep the primary error. */ }
    }
    if (runtime && taskKey && !promptTraces.length) {
      try { promptTraces = runtime.ctx.session.listPromptTraces(taskKey) } catch { /* Keep the primary error. */ }
    }
    if (runtime && taskKey && !toolTrace.length) {
      try { toolTrace = toolTraceForTask(runtime, taskKey) } catch { /* Keep the primary error. */ }
    }
    try { await runtime?.dispose() } catch { /* The run outcome has already been captured. */ }
    await rm(temp, { recursive: true, force: true })
  }
  return {
    taskId, suite: taskId.startsWith('candidate-') ? 'common' : 'context', category: 'recovery', group, repetition, status, failureKind: status === 'passed' ? undefined : status === 'infrastructure_error' ? 'infrastructure' : 'acceptance', detail, durationMs: Date.now() - started,
    modelRequests: usage.requests, modelRounds,
    agentRequests: usage.agentRequests, skillRequests: usage.skillRequests, summaryRequests: usage.summaryRequests, capReason: usage.capReason,
    agentTokens: usage.agentTotal, skillTokens: usage.skillTotal, summaryTokens: usage.summaryTotal,
    inputTokens: usage.complete ? usage.input : null,
    outputTokens: usage.complete ? usage.output : null,
    totalTokens: usage.complete ? usage.total : null,
    usageComplete: usage.complete && usage.requests > 0,
    toolCalls, failedToolCalls, toolDurationMs,
    skillTraces,
    skillSelectionFailures: skillTraces.filter((trace) => trace.status === 'failed').length,
    skillSelectionRequests: skillTraces.reduce((sum, trace) => sum + trace.selectionRequests, 0),
    skillSelectionDurationMs: skillTraces.reduce((sum, trace) => sum + trace.selectionDurationMs, 0),
    skillSelectionTokens: skillSelectionTokens(skillTraces),
    skillContextTokens: skillTraces.reduce((sum, trace) => sum + trace.contextTokens, 0),
    promptTraces, promptStageCompliant: pluginSets[group].includes('prompt') ? promptStagesValid(promptTraces, true) : null,
    recoveryEligible: capabilities[group].recovery,
    recoverySucceeded: capabilities[group].recovery ? status === 'passed' : undefined,
    unknownCallsReplayed: replayed,
    toolTrace,
  }
}

export interface PermissionScenarioResult {
  status: 'passed' | 'failed'
  cases: Array<{ id: string; expected: 'allow' | 'deny'; actual: 'allow' | 'deny'; matched: boolean }>
  falseAllows: number
  falseDenials: number
  unauthorizedOperationBlockRate: number | null
}

export async function runPermissionScenarios(): Promise<PermissionScenarioResult> {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'miniharness-permissions-'))
  const workspace = path.join(temp, 'workspace')
  await mkdir(workspace, { recursive: true })
  await writeFile(path.join(temp, 'outside.txt'), 'outside sentinel', 'utf8')
  await writeFile(path.join(workspace, 'safe.txt'), 'safe sentinel', 'utf8')
  const config = configSchema.parse({
    projectRoot: workspace,
    skillsDir: path.join(workspace, 'skills'),
    sessionDb: path.join(temp, 'state', 'sessions.sqlite'),
    plugins: ['logger', 'hooks', 'permission', 'tools'],
    permissions: { allow: [], deny: [], defaultWrite: 'deny', approvalTimeoutMs: 1000 },
  })
  const cases: PermissionScenarioResult['cases'] = []
  const runtime = await createRuntime(config)
  const check = async (id: string, expected: 'allow' | 'deny', operation: () => Promise<unknown>, expectedCode?: string) => {
    let actual: 'allow' | 'deny' = 'allow'
    let code: string | undefined
    try { await operation() } catch (error) {
      actual = 'deny'
      code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : undefined
    }
    // A deny is only meaningful when it came from the policy or path guard that the
    // case is meant to exercise. Otherwise an allowed command could fail for an
    // unrelated reason (for example, a missing executable) and still look like a deny.
    const codeMatched = expected === 'allow' || expectedCode === undefined || code === expectedCode
    cases.push({ id, expected, actual, matched: expected === actual && codeMatched })
  }
  try {
    await check('read-inside-root', 'allow', () => runtime.ctx.tools.execute('read_file', { path: 'safe.txt' }))
    await check('read-outside-root', 'deny', () => runtime.ctx.tools.execute('read_file', { path: '../outside.txt' }), 'TOOL_EXECUTION_FAILED')
    await check('write-without-grant', 'deny', () => runtime.ctx.tools.execute('write_file', { path: 'blocked.txt', content: 'must not be written' }), 'PERMISSION_DENIED')
    await check('shell-without-approval', 'deny', () => runtime.ctx.tools.execute('run_shell', { command: 'MINIHARNESS_BENCHMARK_COMMAND_MUST_NOT_RUN' }), 'APPROVAL_UNAVAILABLE')
    const allowed = await createRuntime(configSchema.parse({ ...config, permissions: { ...config.permissions, allow: ['write_file'] } }))
    try {
      allowed.ctx.on('tool/before', (call, args) => call.name === 'write_file' ? { ...(args as object), path: '../hook-escape.txt' } : undefined)
      await check('hook-rewritten-write-escape', 'deny', () => allowed.ctx.tools.execute('write_file', { path: 'inside.txt', content: 'must not be written' }), 'TOOL_EXECUTION_FAILED')
    } finally { await allowed.dispose() }
    if (await readFile(path.join(temp, 'hook-escape.txt'), 'utf8').catch(() => '') !== '') {
      cases.at(-1)!.actual = 'allow'
      cases.at(-1)!.matched = false
    }
  } finally { await runtime.dispose(); await rm(temp, { recursive: true, force: true }) }
  const falseAllows = cases.filter((item) => item.expected === 'deny' && item.actual === 'allow').length
  const falseDenials = cases.filter((item) => item.expected === 'allow' && item.actual === 'deny').length
  const denied = cases.filter((item) => item.expected === 'deny')
  return { status: cases.every((item) => item.matched) ? 'passed' : 'failed', cases, falseAllows, falseDenials, unauthorizedOperationBlockRate: denied.length ? (denied.length - falseAllows) / denied.length : null }
}

async function runMcpRecoveryScenario(repetition: number): Promise<EvaluationRun> {
  const started = Date.now()
  const temp = await mkdtemp(path.join(os.tmpdir(), 'miniharness-mcp-recovery-'))
  const workspace = path.join(temp, 'workspace')
  await mkdir(workspace, { recursive: true })
  const marker = path.join(temp, 'disconnect-marker')
  const config = configSchema.parse({
    projectRoot: workspace,
    plugins: ['logger', 'hooks', 'permission', 'tools', 'mcp'],
    mcp: { servers: [{ id: 'benchmark', transport: 'stdio', command: process.execPath, args: [path.resolve('scripts/fixtures/mcp-benchmark-server.mjs'), marker], cwd: workspace, permission: 'read' }], connectTimeoutMs: 5_000, reconnectProbeMs: 10_000 },
  })
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined
  let discovered = false
  let offline = false
  let recovered = false
  let passed = false
  let toolCalls = 0
  let failedToolCalls = 0
  let detail = ''
  let failure: unknown
  try {
    runtime = await createRuntime(config)
    const tool = runtime.ctx.tools.definitions().find((item) => item.name.includes('_disconnect_once_'))
    discovered = Boolean(tool)
    if (!tool) throw new Error('MCP disconnect tool was not discovered')
    toolCalls++
    try { await runtime.ctx.tools.execute(tool.name, {}) } catch (error) { failedToolCalls++; throw error }
    const deadline = Date.now() + 7_000
    while (Date.now() < deadline) {
      const present = runtime.ctx.tools.definitions().some((item) => item.name === tool.name)
      if (!present) offline = true
      if (offline && present) { recovered = true; break }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (!offline || !recovered) throw new Error(`MCP reconnect did not complete (offline=${offline}, recovered=${recovered})`)
    toolCalls++
    const result = await runtime.ctx.tools.execute(tool.name, {}).catch((error) => { failedToolCalls++; throw error })
    if (result.isError || result.content[0]?.text !== 'disconnect-requested') throw new Error('Rediscovered MCP tool did not execute')
    detail = 'Observed tool removal, reconnect, rediscovery, and successful call.'
    passed = true
  } catch (error) {
    failure = error
    detail = error instanceof Error ? error.message : String(error)
  }
  finally { try { await runtime?.dispose() } finally { await rm(temp, { recursive: true, force: true }) } }
  const infrastructure = !passed && isInfrastructureFailure(failure)
  return {
    taskId: 'mcp-recovery', suite: 'mcp', category: 'connection-recovery', group: 'full', repetition,
    status: passed ? 'passed' : infrastructure ? 'infrastructure_error' : 'failed',
    failureKind: passed ? undefined : infrastructure ? 'infrastructure' : 'acceptance', detail,
    durationMs: Date.now() - started, modelRequests: 0, modelRounds: 0, inputTokens: null, outputTokens: null, totalTokens: null,
    usageComplete: false, toolCalls, failedToolCalls, toolDurationMs: 0,
    mcpDiscovered: discovered, mcpRecoverySucceeded: passed,
  }
}

export async function runBenchmark(options: BenchmarkOptions = {}) {
  const repetitions = options.repetitions ?? 3
  const selectedTasks = options.tasks?.length ? options.tasks : [...commonBenchmarkTasks.map((task) => task.id), ...benchmarkTasks.filter((task) => task.suite).map((task) => task.id), 'fault-recovery', 'mcp-recovery']
  const selectedGroups = options.groups?.length ? options.groups : groups
  const maxAgentRounds = options.maxAgentRounds ?? MAX_AGENT_ROUNDS
  const timeoutMs = options.timeoutMs ?? 900_000
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20) throw new Error('Repetitions must be an integer from 1 to 20')
  if (!Number.isInteger(maxAgentRounds) || maxAgentRounds < 1 || maxAgentRounds > MAX_AGENT_ROUNDS) throw new Error(`Agent rounds must be an integer from 1 to ${MAX_AGENT_ROUNDS}`)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 900_000) throw new Error('Timeout must be between 1 ms and 15 minutes')
  for (const taskId of selectedTasks) if (!['fault-recovery', 'mcp-recovery'].includes(taskId) && !benchmarkTasks.some((task) => task.id === taskId)) throw new Error(`Unknown task: ${taskId}`)
  for (const group of selectedGroups) if (!groups.includes(group)) throw new Error(`Unknown group: ${group}`)
  if (selectedTasks.some((id) => id !== 'mcp-recovery') && !process.env.DEEPSEEK_API_KEY && !options.fetchImpl) throw new Error('DEEPSEEK_API_KEY is required for the real-model benchmark; set it in .env or the environment')

  const fixtureRoot = path.resolve('evaluation/fixtures')
  const runs: EvaluationRun[] = []
  for (const taskId of selectedTasks.filter((item) => item !== 'fault-recovery' && item !== 'mcp-recovery')) {
    const task = benchmarkTasks.find((item) => item.id === taskId)
    if (task?.candidateFamily === 'recovery') {
      for (const group of selectedGroups) {
        for (let repetition = 1; repetition <= repetitions; repetition++) runs.push(await runRecoveryOne(group, repetition, { maxAgentRounds, timeoutMs }, options.fetchImpl, taskId))
      }
      continue
    }
    const suite = task?.suite
    const fullGroups = selectedGroups.filter((group) => group.startsWith('full'))
    const eligibleGroups = suite === 'mcp' ? fullGroups
      : suite === 'skills' ? selectedGroups.filter((group) => group === 'skills' || group.startsWith('full'))
      : suite === 'prompt' ? selectedGroups.filter((group) => group === 'prompt' || group === 'full' || group === 'full-no-skills' || group === 'full-no-context')
      : suite === 'context' ? selectedGroups.filter((group) => group === 'session-context' || group.startsWith('full')) : selectedGroups
    for (const group of eligibleGroups) {
      for (let repetition = 1; repetition <= repetitions; repetition++) {
        runs.push(await runOne(taskId, group, repetition, { maxAgentRounds, timeoutMs }, fixtureRoot, options.fetchImpl))
      }
    }
  }
  if (selectedTasks.includes('fault-recovery')) {
    for (const group of selectedGroups.filter((item) => capabilities[item].recovery)) {
      for (let repetition = 1; repetition <= repetitions; repetition++) runs.push(await runRecoveryOne(group, repetition, { maxAgentRounds, timeoutMs }, options.fetchImpl))
    }
  }
  if (selectedTasks.includes('mcp-recovery')) {
    for (const group of selectedGroups.filter((item) => item.startsWith('full'))) {
      for (let repetition = 1; repetition <= repetitions; repetition++) runs.push({ ...await runMcpRecoveryScenario(repetition), group })
    }
  }
  const summary = summarizeRuns(runs)
  const permission = await runPermissionScenarios()
  const markdown = `${renderMarkdown(summary, runs)}\n## Permission scenarios\n\n- Status: ${permission.status}\n- Unauthorized operation block rate: ${permission.unauthorizedOperationBlockRate === null ? 'n/a' : `${(permission.unauthorizedOperationBlockRate * 100).toFixed(1)}%`}\n- Cases matched reference policy: ${permission.cases.filter((item) => item.matched).length}/${permission.cases.length}\n- False allows: ${permission.falseAllows}\n- False denials: ${permission.falseDenials}\n`
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDirectory = path.resolve(options.outputDirectory ?? path.join('.miniharness', 'evals', 'benchmark', timestamp))
  await mkdir(outputDirectory, { recursive: true })
  const report = {
    version: 7,
    fixtureVersion: benchmarkVersion,
    createdAt: new Date().toISOString(),
    model: 'deepseek-flash',
    configurations: Object.fromEntries(selectedGroups.map((group) => [group, { plugins: pluginSets[group], capabilities: capabilities[group], toolRetries: 0, maxIterations: maxAgentRounds, maxTaskIterations: maxAgentRounds, ordinaryTaskIterations: maxAgentRounds, recoverySegmentIterations: 8, contextBudgetNote: 'contextInputTokens in taskSet is the hard input limit; output reserve is separate (2048 tokens, or 512 for context-compression). Context-compression L3 max is 256 tokens.', prompts: pluginSets[group].includes('prompt') ? { versions: { 'task/benchmark-initial': '2' }, templates: ['task/benchmark-initial@2', 'task/benchmark-followup@1'] } : null, permissions: { allow: ['write_file', 'benchmark_interrupt'], deny: [], defaultWrite: 'deny' } }])),
    taskSet: selectedTasks.map((id) => {
      const task = benchmarkTasks.find((item) => item.id === id)
      const context = evaluationContextSettings(id, task?.contextBudget)
      return {
        id,
        suite: task ? task.suite ?? 'common' : id === 'fault-recovery' ? 'context' : 'mcp',
        category: task?.category ?? 'recovery',
        candidateFamily: task?.candidateFamily,
        steps: task?.candidateFamily === 'recovery' ? 2 : task?.steps.length ?? 1,
        contextInputTokens: context.hardInputTokens,
        contextWindowTokens: context.contextWindowTokens,
        contextOutputReserve: context.outputReserve,
        ...(id === 'context-compression' ? { contextSoftThreshold: 0.6, layerBudgets: { L0: [900, 1600], L1: [180, 300], L2: [100, 180], L3: [128, 256] } } : task?.candidateFamily === 'context' ? { requiredSummaryLayers: ['L2', 'L3'] } : {}),
      }
    }),
    tokenUsage: { knownTotal: runs.filter((run) => run.usageComplete).reduce((sum, run) => sum + (run.totalTokens ?? 0), 0), agentTokens: runs.reduce((sum, run) => sum + (run.agentTokens ?? 0), 0), skillSelectionTokens: runs.reduce((sum, run) => sum + (run.skillTokens ?? 0), 0), summaryTokens: runs.reduce((sum, run) => sum + (run.summaryTokens ?? 0), 0), agentRequests: runs.reduce((sum, run) => sum + (run.agentRequests ?? 0), 0), skillSelectionRequests: runs.reduce((sum, run) => sum + (run.skillRequests ?? 0), 0), summaryRequests: runs.reduce((sum, run) => sum + (run.summaryRequests ?? 0), 0), runsWithCompleteUsage: runs.filter((run) => run.usageComplete).length, runsMissingUsage: runs.filter((run) => run.modelRequests > 0 && !run.usageComplete).length },
    parameters: { temperature: 0, repetitions, groups: selectedGroups, tasks: selectedTasks, maxAgentRounds, maxTotalRequests: MAX_TOTAL_REQUESTS, maxTotalTokens: MAX_TOTAL_TOKENS, timeoutMs, ordinaryTaskIterations: maxAgentRounds, recoverySegmentIterations: 8, wallClockLimitMs: 900_000, l3MaxTokens: 256, skillAndSummaryRequestsCountAgainstAgentRounds: false },
    runs,
    summary,
    permission,
  }
  await writeFile(path.join(outputDirectory, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(path.join(outputDirectory, 'summary.md'), markdown, 'utf8')
  await writeFile(path.join(outputDirectory, 'runs.csv'), renderCsv(runs), 'utf8')
  await writeFile(path.join(outputDirectory, 'permission.json'), `${JSON.stringify(permission, null, 2)}\n`, 'utf8')
  return { outputDirectory, report, markdown }
}

export { groups as evaluationGroups }
