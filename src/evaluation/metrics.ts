import type { ContextCheckpoint, PromptTrace, SkillTrace } from '../types.js'
export type EvaluationGroup = 'baseline' | 'skills' | 'session-context' | 'prompt' | 'full' | 'full-no-skills' | 'full-no-prompt' | 'full-no-context'
export type RunStatus = 'passed' | 'failed' | 'infrastructure_error'

export interface ContextRequestObservation {
  step: number
  estimatedTokens: number
  inputLimit: number
  summaryLevels: Array<'L1' | 'L2' | 'L3'>
  recentTaskPresent: boolean
  toolLinksValid: boolean
}

export interface ToolTraceEntry {
  name: string
  arguments: string
  status: string
  result: string | null
  attempts: Array<{ status: string; errorCode: string | null; error: string | null; approval: string | null }>
}

export interface EvaluationRun {
  taskId: string
  group: EvaluationGroup
  repetition: number
  status: RunStatus
  detail: string
  durationMs: number
  modelRequests: number
  modelRounds?: number
  agentRequests?: number
  skillRequests?: number
  summaryRequests?: number
  agentTokens?: number
  skillTokens?: number
  summaryTokens?: number
  capReason?: string
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  usageComplete: boolean
  toolCalls: number
  failedToolCalls: number
  toolDurationMs: number
  suite?: string
  category?: string
  scored?: boolean
  failureKind?: 'infrastructure' | 'model_execution' | 'acceptance'
  stepResults?: Array<{ index: number; passed: boolean; detail: string }>
  expectedSkills?: string[]
  skillSelectionCorrect?: boolean | null
  promptTraces?: PromptTrace[]
  promptStageCompliant?: boolean | null
  contextCheckpoints?: ContextCheckpoint[]
  contextTimeline?: Array<{ step: number; checkpoints: ContextCheckpoint[] }>
  contextRequests?: ContextRequestObservation[]
  toolTrace?: ToolTraceEntry[]
  contextPreserved?: boolean | null
  contextCompressionObserved?: boolean | null
  mcpDiscovered?: boolean | null
  mcpToolCount?: number | null
  mcpRecoverySucceeded?: boolean | null
  skillTraces?: SkillTrace[]
  skillSelectionFailures?: number
  skillSelectionRequests?: number
  skillSelectionDurationMs?: number
  skillSelectionTokens?: number | null
  skillContextTokens?: number
  recoveryEligible?: boolean
  recoverySucceeded?: boolean
  unknownCallsReplayed?: boolean
}

export interface MetricSummary {
  taskId: string
  group: EvaluationGroup
  validRuns: number
  infrastructureErrors: number
  completedRuns: number
  completionRate: number | null
  meanToolCallsOnSuccess: number | null
  meanToolCallsAllValid: number | null
  meanFailedToolCalls: number | null
  meanToolDurationMs: number | null
  usageRuns: number
  meanInputTokens: number | null
  meanOutputTokens: number | null
  meanTotalTokens: number | null
  meanTokensPerSuccessfulTask: number | null
  amortizedTokensPerCompletion: number | null
  agentRoundsPerSuccess: number | null
  apiCallsPerSuccess: number | null
  completionWithin25k: number | null
  completionWithin50k: number | null
  completionWithin100k: number | null
  recoveryEligibleRuns: number
  recoverySucceededRuns: number
  recoverySuccessRate: number | null
  unknownCallsReplayed: number
  skillSelectionFailures: number
  skillSelectionRequests: number
  meanSkillSelectionTokens: number | null
  meanSkillContextTokens: number | null
  meanModelRounds: number | null
  meanLatencyMs: number | null
  skillSelectionAccuracy: number | null
  promptStageComplianceRate: number | null
  contextPreservationRate: number | null
  contextCompressionRate: number | null
  mcpDiscoveryRate: number | null
  mcpRecoveryRate: number | null
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const rate = (values: boolean[]) => values.length ? values.filter(Boolean).length / values.length : null

export function summarizeRuns(runs: EvaluationRun[]): MetricSummary[] {
  const groups = new Map<string, EvaluationRun[]>()
  for (const run of runs) {
    const key = `${run.taskId}\0${run.group}`
    const current = groups.get(key) ?? []
    current.push(run)
    groups.set(key, current)
  }
  return [...groups.values()].map((items) => {
    const valid = items.filter((run) => run.status !== 'infrastructure_error')
    const success = valid.filter((run) => run.status === 'passed')
    const withUsage = valid.filter((run) => run.usageComplete && run.totalTokens !== null)
    const successfulWithUsage = success.filter((run) => run.usageComplete && run.totalTokens !== null)
    const within = (budget: number) => rate(valid.filter((run) => run.usageComplete && run.totalTokens !== null).map((run) => run.status === 'passed' && run.totalTokens! <= budget))
    const recovery = valid.filter((run) => run.recoveryEligible)
    const succeededRecovery = recovery.filter((run) => run.recoverySucceeded)
    return {
      taskId: items[0].taskId,
      group: items[0].group,
      validRuns: valid.length,
      infrastructureErrors: items.length - valid.length,
      completedRuns: success.length,
      completionRate: valid.length ? success.length / valid.length : null,
      meanToolCallsOnSuccess: mean(success.map((run) => run.toolCalls)),
      meanToolCallsAllValid: mean(valid.map((run) => run.toolCalls)),
      meanFailedToolCalls: mean(valid.map((run) => run.failedToolCalls)),
      meanToolDurationMs: mean(valid.map((run) => run.toolDurationMs)),
      usageRuns: withUsage.length,
      meanInputTokens: mean(withUsage.map((run) => run.inputTokens!)),
      meanOutputTokens: mean(withUsage.map((run) => run.outputTokens!)),
      meanTotalTokens: mean(withUsage.map((run) => run.totalTokens!)),
      meanTokensPerSuccessfulTask: mean(successfulWithUsage.map((run) => run.totalTokens!)),
      amortizedTokensPerCompletion: successfulWithUsage.length ? withUsage.reduce((sum, run) => sum + run.totalTokens!, 0) / successfulWithUsage.length : null,
      agentRoundsPerSuccess: mean(success.map((run) => run.modelRounds ?? run.agentRequests ?? run.modelRequests)),
      apiCallsPerSuccess: mean(success.map((run) => run.modelRequests)),
      completionWithin25k: within(25_000),
      completionWithin50k: within(50_000),
      completionWithin100k: within(100_000),
      recoveryEligibleRuns: recovery.length,
      recoverySucceededRuns: succeededRecovery.length,
      recoverySuccessRate: recovery.length ? succeededRecovery.length / recovery.length : null,
      unknownCallsReplayed: valid.filter((run) => run.unknownCallsReplayed).length,
      skillSelectionFailures: valid.reduce((sum, run) => sum + (run.skillSelectionFailures ?? 0), 0),
      skillSelectionRequests: valid.reduce((sum, run) => sum + (run.skillSelectionRequests ?? 0), 0),
      meanSkillSelectionTokens: mean(valid.filter((run) => run.skillSelectionTokens !== null && run.skillSelectionTokens !== undefined).map((run) => run.skillSelectionTokens!)),
      meanSkillContextTokens: mean(valid.map((run) => run.skillContextTokens ?? 0)),
      meanModelRounds: mean(valid.map((run) => run.modelRounds ?? run.modelRequests)),
      meanLatencyMs: mean(valid.map((run) => run.durationMs)),
      skillSelectionAccuracy: rate(valid.filter((run) => run.skillSelectionCorrect !== null && run.skillSelectionCorrect !== undefined).map((run) => run.skillSelectionCorrect!)),
      promptStageComplianceRate: rate(valid.filter((run) => run.promptStageCompliant !== null && run.promptStageCompliant !== undefined).map((run) => run.promptStageCompliant!)),
      contextPreservationRate: rate(valid.filter((run) => run.contextPreserved !== null && run.contextPreserved !== undefined).map((run) => run.contextPreserved!)),
      // This records whether the required summary levels were present in actual requests;
      // task acceptance remains a separate completion metric.
      contextCompressionRate: rate(valid.filter((run) => run.contextCompressionObserved !== null && run.contextCompressionObserved !== undefined).map((run) => run.contextCompressionObserved!)),
      // Registration happens before the model runs, so only a passed MCP task proves that
      // the model actually discovered and used the remote tool. mcp-recovery is a
      // connection test, not a discovery test, and is reported through mcpRecoveryRate.
      mcpDiscoveryRate: rate(valid.filter((run) => run.taskId !== 'mcp-recovery' && run.mcpDiscovered !== null && run.mcpDiscovered !== undefined).map((run) => run.status === 'passed' && run.mcpDiscovered!)),
      mcpRecoveryRate: rate(valid.filter((run) => run.mcpRecoverySucceeded !== null && run.mcpRecoverySucceeded !== undefined).map((run) => run.mcpRecoverySucceeded!)),
    }
  }).sort((a, b) => a.taskId.localeCompare(b.taskId) || a.group.localeCompare(b.group))
}

const ratio = (value: number | null) => value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`
const number = (value: number | null, digits = 1) => value === null ? 'n/a' : value.toFixed(digits)

export function renderPluginEffectTable(runs: EvaluationRun[]) {
  const taskIds = [...new Set(runs.filter((run) => run.taskId.startsWith('plugin-')).map((run) => run.taskId))]
  if (!taskIds.length) return ''
  const lines = [
    '## Plugin-gated task effects',
    '',
    '| Task | Group | Passed / valid | Tokens / success | Tools / success | Agent rounds | API calls | Summary calls |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]
  for (const taskId of taskIds) {
    const groups = [...new Set(runs.filter((run) => run.taskId === taskId).map((run) => run.group))]
    for (const group of groups) {
      const items = runs.filter((run) => run.taskId === taskId && run.group === group && run.status !== 'infrastructure_error')
      const success = items.filter((run) => run.status === 'passed')
      const withUsage = success.filter((run) => run.usageComplete && run.totalTokens !== null)
      lines.push(`| ${taskId} | ${group} | ${success.length}/${items.length} | ${number(mean(withUsage.map((run) => run.totalTokens!)), 0)} | ${number(mean(success.map((run) => run.toolCalls)))} | ${number(mean(items.map((run) => run.agentRequests ?? run.modelRounds ?? run.modelRequests)))} | ${number(mean(items.map((run) => run.modelRequests)))} | ${number(mean(items.map((run) => run.summaryRequests ?? 0)))} |`)
    }
  }
  return lines.join('\n')
}

export function renderMarkdown(summary: MetricSummary[], runs: EvaluationRun[]) {
  const rows = summary.map((item) => `| ${item.taskId} | ${item.group} | ${item.completedRuns}/${item.validRuns} | ${ratio(item.completionRate)} | ${number(item.meanToolCallsOnSuccess)} | ${number(item.meanModelRounds)} | ${number(item.meanTotalTokens, 0)} | ${number(item.meanLatencyMs, 0)} | ${ratio(item.skillSelectionAccuracy)} | ${ratio(item.promptStageComplianceRate)} | ${ratio(item.contextPreservationRate)} | ${ratio(item.contextCompressionRate)} | ${ratio(item.mcpDiscoveryRate)} | ${ratio(item.mcpRecoveryRate)} | ${item.infrastructureErrors} |`)
  const groupStats = [...new Set(summary.map((item) => item.group))].map((group) => {
    const sharedRunItems = runs.filter((run) => run.group === group && run.scored !== false && (run.suite === 'common' || (!run.suite && run.taskId !== 'fault-recovery')))
    const validRuns = sharedRunItems.filter((run) => run.status !== 'infrastructure_error')
    const successful = validRuns.filter((run) => run.status === 'passed')
    const usageValid = validRuns.filter((run) => run.usageComplete && run.totalTokens !== null)
    const usageSuccess = usageValid.filter((run) => run.status === 'passed')
    return {
      group,
      valid: validRuns.length,
      completed: successful.length,
      completion: validRuns.length ? successful.length / validRuns.length : null,
      toolsPerSuccess: mean(successful.map((run) => run.toolCalls)),
      agentRounds: mean(validRuns.map((run) => run.agentRequests ?? run.modelRounds ?? run.modelRequests)),
      apiCalls: mean(validRuns.map((run) => run.modelRequests)),
      tokensPerSuccess: mean(usageSuccess.map((run) => run.totalTokens!)),
      amortizedTokensPerSuccess: usageSuccess.length ? usageValid.reduce((sum, run) => sum + run.totalTokens!, 0) / usageSuccess.length : null,
      latencyPerSuccess: mean(successful.map((run) => run.durationMs)),
      callsPerSuccess: mean(usageSuccess.map((run) => run.modelRequests)),
      agentTokensPerRun: mean(usageValid.map((run) => run.agentTokens ?? 0)),
      skillTokensPerRun: mean(usageValid.map((run) => run.skillTokens ?? 0)),
      summaryTokensPerRun: mean(usageValid.map((run) => run.summaryTokens ?? 0)),
      agentRequestsPerRun: mean(validRuns.map((run) => run.agentRequests ?? run.modelRounds ?? run.modelRequests)),
      skillRequestsPerRun: mean(validRuns.map((run) => run.skillRequests ?? 0)),
      summaryRequestsPerRun: mean(validRuns.map((run) => run.summaryRequests ?? 0)),
      completionWithin: (budget: number) => rate(usageValid.map((run) => run.status === 'passed' && run.totalTokens! <= budget)),
      infra: sharedRunItems.length - validRuns.length,
    }
  })
  const totals = groupStats.map((item) => `| ${item.group} | ${item.completed}/${item.valid} | ${ratio(item.completion)} | ${number(item.toolsPerSuccess)} | ${number(item.agentRounds)} | ${number(item.apiCalls)} | ${number(item.tokensPerSuccess, 0)} | ${number(item.amortizedTokensPerSuccess, 0)} | ${number(item.latencyPerSuccess, 0)} | ${item.infra} |`)
  const baseline = groupStats.find((item) => item.group === 'baseline')
  const percentDelta = (value: number | null, base: number | null) => value === null || base === null || base === 0 ? 'n/a' : `${value >= base ? '+' : ''}${((value - base) / base * 100).toFixed(1)}%`
  const pointDelta = (value: number | null, base: number | null) => value === null || base === null ? 'n/a' : `${value >= base ? '+' : ''}${((value - base) * 100).toFixed(1)} pp`
  const deltas = groupStats.map((item) => `| ${item.group} | ${ratio(item.completion)} | ${baseline ? pointDelta(item.completion, baseline.completion) : 'n/a'} | ${number(item.tokensPerSuccess, 0)} | ${number(item.amortizedTokensPerSuccess, 0)} | ${number(item.callsPerSuccess)} | ${ratio(item.completionWithin(25_000))} | ${ratio(item.completionWithin(50_000))} | ${ratio(item.completionWithin(100_000))} | ${baseline ? percentDelta(item.latencyPerSuccess, baseline.latencyPerSuccess) : 'n/a'} |`)
  const tokenBreakdown = groupStats.map((item) => `| ${item.group} | ${number(item.agentRequestsPerRun)} | ${number(item.agentTokensPerRun, 0)} | ${number(item.skillRequestsPerRun)} | ${number(item.skillTokensPerRun, 0)} | ${number(item.summaryRequestsPerRun)} | ${number(item.summaryTokensPerRun, 0)} |`)
  const full = groupStats.find((item) => item.group === 'full')
  const fullMinus = ['baseline', 'full-no-skills', 'full-no-prompt', 'full-no-context'].map((group) => {
    const comparison = groupStats.find((item) => item.group === group)
    if (!comparison) return ''
    const completionDiff = full?.completion !== null && full?.completion !== undefined && comparison.completion !== null ? `${((full.completion - comparison.completion) * 100).toFixed(1)} pp` : 'n/a'
    const tokenDiff = full?.amortizedTokensPerSuccess !== null && full?.amortizedTokensPerSuccess !== undefined && comparison.amortizedTokensPerSuccess !== null ? number(full.amortizedTokensPerSuccess - comparison.amortizedTokensPerSuccess, 0) : 'n/a'
    const callDiff = full?.callsPerSuccess !== null && full?.callsPerSuccess !== undefined && comparison.callsPerSuccess !== null ? number(full.callsPerSuccess - comparison.callsPerSuccess) : 'n/a'
    return `| Full − ${group} | ${completionDiff} | ${tokenDiff} | ${callDiff} |`
  }).filter(Boolean)
  const specialized = [...new Set(summary.map((item) => item.taskId))]
    .filter((taskId) => runs.some((run) => run.taskId === taskId && run.suite !== 'common'))
    .map((taskId) => {
      const items = summary.filter((item) => item.taskId === taskId)
      const passed = items.reduce((sum, item) => sum + item.completedRuns, 0)
      const validRuns = items.reduce((sum, item) => sum + item.validRuns, 0)
      const infrastructureErrors = items.reduce((sum, item) => sum + item.infrastructureErrors, 0)
      const groups = [...new Set(items.map((item) => item.group))].join(', ')
      return `| ${taskId} | ${groups} | ${passed}/${validRuns} | ${ratio(validRuns ? passed / validRuns : null)} | ${infrastructureErrors} |`
    })
  const individual = runs.map((run) => `| ${run.taskId} | ${run.group} | ${run.repetition} | ${run.status} | ${run.failureKind ?? '—'} | ${run.agentRequests ?? run.modelRounds ?? run.modelRequests} / ${run.skillRequests ?? 0} / ${run.summaryRequests ?? 0} | ${run.capReason ?? '—'} | ${run.toolCalls} | ${run.totalTokens ?? 'n/a'} | ${run.durationMs} | ${run.detail.replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 160)} |`)
  return [
    '# MiniHarness Benchmark Results',
    '',
    `Runs: ${runs.length}; created at: ${new Date().toISOString()}. Infrastructure errors are excluded from completion-rate denominators.`,
    '',
    '## Per-task results',
    '',
    '| Task | Group | Passed / valid | Completion | Tools / success | Model rounds | API tokens | Latency ms | Skill accuracy | Prompt stages | Context preserved | Context compressed | MCP discovery | MCP recovery | Infra errors |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    '## Shared suite totals',
    '',
    '| Group | Passed / valid task runs | Completion | Tools / success | Agent rounds | API calls | Tokens / successful task | Amortized tokens / completion | Latency / success ms | Infra errors |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...totals,
    '',
    '### Model request and token breakdown per valid run',
    '',
    '| Group | Agent requests | Agent tokens | Skill selection requests | Skill selection tokens | Summary requests | Summary tokens |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...tokenBreakdown,
    '',
    '## Group comparison (shared common tasks)',
    '',
    '| Group | Completion | Δ completion | Tokens / success | Amortized tokens / completion | API calls / success | ≤25k completion | ≤50k completion | ≤100k completion | Δ latency |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...deltas,
    '',
    'Deltas are relative to the baseline group; negative token, latency, and API-call deltas are improvements. Completion deltas are percentage points.',
    '',
    '### Full-minus-one attribution contrasts',
    '',
    '| Contrast | Completion difference | Amortized token difference | API calls / successful task difference |',
    '| --- | ---: | ---: | ---: |',
    ...fullMinus,
    '',
    renderPluginEffectTable(runs),
    '',
    '## Individual runs',
    '',
    '| Task | Group | Repeat | Status | Failure kind | Agent / Skill / Summary requests | Cap reason | Tools | API tokens | Latency ms | Acceptance detail |',
    '| --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |',
    ...individual,
    ...(specialized.length ? ['', '## Specialized scenarios', '', '| Scenario | Groups | Passed / valid | Completion | Infra errors |', '| --- | --- | ---: | ---: | ---: |', ...specialized] : []),
    '',
    'Token averages and budget completion use only runs with complete API usage. Infrastructure errors are excluded from completion rates. Specialized scenarios are reported separately. Per-run cap reasons are recorded in JSON and CSV.',
    '',
  ].join('\n')
}

const csvCell = (value: unknown) => {
  const string = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string
}

export function renderCsv(runs: EvaluationRun[]) {
  const columns: Array<keyof EvaluationRun> = ['taskId', 'suite', 'category', 'group', 'repetition', 'status', 'failureKind', 'detail', 'durationMs', 'modelRequests', 'modelRounds', 'agentRequests', 'skillRequests', 'summaryRequests', 'agentTokens', 'skillTokens', 'summaryTokens', 'capReason', 'inputTokens', 'outputTokens', 'totalTokens', 'usageComplete', 'toolCalls', 'failedToolCalls', 'toolDurationMs', 'skillSelectionFailures', 'skillSelectionRequests', 'skillSelectionDurationMs', 'skillSelectionTokens', 'skillContextTokens', 'skillSelectionCorrect', 'promptStageCompliant', 'contextPreserved', 'contextCompressionObserved', 'mcpDiscovered', 'mcpToolCount', 'mcpRecoverySucceeded', 'recoveryEligible', 'recoverySucceeded', 'unknownCallsReplayed', 'stepResults', 'skillTraces', 'promptTraces', 'contextCheckpoints', 'contextTimeline', 'contextRequests', 'toolTrace']
  return [columns.join(','), ...runs.map((run) => columns.map((column) => csvCell(typeof run[column] === 'object' && run[column] !== null ? JSON.stringify(run[column]) : run[column])).join(','))].join('\n') + '\n'
}
