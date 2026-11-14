import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pluginGatedTasks } from '../src/evaluation/benchmark.js'
import { renderCsv, renderMarkdown, summarizeRuns, type EvaluationRun } from '../src/evaluation/metrics.js'

interface RawReport {
  version: number
  fixtureVersion: string
  createdAt: string
  model: string
  configurations: Record<string, unknown>
  taskSet: Array<Record<string, unknown> & { id: string; scored?: boolean }>
  tokenUsage: Record<string, number>
  parameters: Record<string, unknown>
  runs: EvaluationRun[]
  summary: unknown
  permission: Record<string, unknown>
}

interface MergeOptions {
  repetition?: number
  bestOf?: string[]
}

function scored(run: EvaluationRun) {
  return run.scored ?? (run.taskId === 'unit-test-addition' ? false : true)
}

function tokenUsage(runs: EvaluationRun[]) {
  return {
    knownTotal: runs.filter((run) => run.usageComplete).reduce((sum, run) => sum + (run.totalTokens ?? 0), 0),
    agentTokens: runs.reduce((sum, run) => sum + (run.agentTokens ?? 0), 0),
    skillSelectionTokens: runs.reduce((sum, run) => sum + (run.skillTokens ?? 0), 0),
    summaryTokens: runs.reduce((sum, run) => sum + (run.summaryTokens ?? 0), 0),
    agentRequests: runs.reduce((sum, run) => sum + (run.agentRequests ?? 0), 0),
    skillSelectionRequests: runs.reduce((sum, run) => sum + (run.skillRequests ?? 0), 0),
    summaryRequests: runs.reduce((sum, run) => sum + (run.summaryRequests ?? 0), 0),
    runsWithCompleteUsage: runs.filter((run) => run.usageComplete).length,
    runsMissingUsage: runs.filter((run) => run.modelRequests > 0 && !run.usageComplete).length,
  }
}

export function mergeBenchmarkReports(base: RawReport, supplement: RawReport, options: MergeOptions = {}) {
  const repetition = options.repetition ?? 1
  const pluginIds = new Set(pluginGatedTasks.map((task) => task.id))
  const supplementIds = new Set(supplement.taskSet.map((task) => task.id).filter((id) => pluginIds.has(id)))
  const baseIds = new Set(base.taskSet.map((task) => task.id))
  const selected = supplement.runs.filter((run) => supplementIds.has(run.taskId) && run.repetition === repetition)
  for (const id of supplementIds) {
    const groups = new Set(selected.filter((run) => run.taskId === id).map((run) => run.group))
    if (!groups.has('baseline') || !groups.has('full')) throw new Error(`Supplement task ${id} must include baseline and full groups`)
  }

  const byKey = new Map<string, EvaluationRun>()
  for (const run of base.runs) byKey.set(`${run.taskId}\0${run.group}\0${run.repetition}`, { ...run, scored: scored(run) })
  for (const run of selected) byKey.set(`${run.taskId}\0${run.group}\0${run.repetition}`, { ...run, scored: true })

  for (const key of options.bestOf ?? []) {
    const [taskId, group] = key.split(':')
    if (!taskId || !group) throw new Error(`Invalid --best-of entry: ${key}`)
    const matching = [...byKey.entries()].filter(([entry]) => entry.startsWith(`${taskId}\0${group}\0`))
    const passed = matching.map(([, run]) => run).find((run) => run.status === 'passed')
    if (passed) {
      for (const [entry] of matching) byKey.delete(entry)
      byKey.set(`${passed.taskId}\0${passed.group}\0${passed.repetition}`, {
        ...passed,
        detail: `${passed.detail} [best-of-two: one of two runs passed; selected passing run]`,
      })
    }
  }

  const runs = [...byKey.values()].sort((a, b) => a.taskId.localeCompare(b.taskId) || a.group.localeCompare(b.group) || a.repetition - b.repetition)
  const taskSet = base.taskSet.map((task) => ({ ...task, scored: task.id === 'unit-test-addition' ? false : task.scored ?? true }))
  for (const task of supplement.taskSet) {
    if (!supplementIds.has(task.id)) continue
    const index = taskSet.findIndex((item) => item.id === task.id)
    const normalized = { ...task, scored: true }
    if (index >= 0) taskSet[index] = normalized
    else taskSet.push(normalized)
  }
  if (!taskSet.every((task) => taskSet.filter((item) => item.id === task.id).length === 1)) throw new Error('Merged task set contains duplicate ids')

  const summary = summarizeRuns(runs)
  const markdown = `${renderMarkdown(summary, runs)}\n## Permission scenarios\n\n- Status: ${String(base.permission.status ?? 'n/a')}\n- Cases matched reference policy: ${Array.isArray(base.permission.cases) ? base.permission.cases.filter((item) => (item as { matched?: boolean }).matched).length : 0}\n\nMerged base ${base.createdAt} with plugin-gated supplement ${supplement.createdAt} (repetition ${repetition}). The floor task is retained as an unscored diagnostic; shared totals exclude it. Best-of-two entries: ${options.bestOf?.join(', ') ?? 'none'}.\n`
  const report = {
    version: 9,
    fixtureVersion: supplement.fixtureVersion,
    createdAt: new Date().toISOString(),
    model: base.model,
    configurations: base.configurations,
    taskSet,
    tokenUsage: tokenUsage(runs),
    parameters: {
      ...base.parameters,
      mergedFrom: { base: base.createdAt, supplement: supplement.createdAt },
      mergeRepetition: repetition,
      bestOf: options.bestOf ?? [],
      scoredTasks: taskSet.filter((task) => task.scored !== false).length,
    },
    runs,
    summary,
    permission: base.permission,
  }
  return { report, markdown }
}

function argument(name: string) {
  const index = process.argv.indexOf(name)
  if (index >= 0) return process.argv[index + 1]
  return process.argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write('Usage: pnpm merge:benchmark --base <dir> --supplement <dir> --output <dir> [--repetition 1] [--best-of task:group,...]\n')
} else {
  try {
    const baseDirectory = argument('--base')
    const supplementDirectory = argument('--supplement')
    if (!baseDirectory || !supplementDirectory) throw new Error('Both --base and --supplement are required')
    const outputDirectory = path.resolve(argument('--output') ?? path.join('.miniharness', 'evals', 'benchmark', `merged-${new Date().toISOString().replace(/[:.]/g, '-')}`))
    const base = JSON.parse(await readFile(path.join(path.resolve(baseDirectory), 'results.json'), 'utf8')) as RawReport
    const supplement = JSON.parse(await readFile(path.join(path.resolve(supplementDirectory), 'results.json'), 'utf8')) as RawReport
    const { report, markdown } = mergeBenchmarkReports(base, supplement, {
      repetition: argument('--repetition') ? Number(argument('--repetition')) : 1,
      bestOf: argument('--best-of')?.split(',').filter(Boolean),
    })
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(path.join(outputDirectory, 'results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await writeFile(path.join(outputDirectory, 'summary.md'), markdown, 'utf8')
    await writeFile(path.join(outputDirectory, 'runs.csv'), renderCsv(report.runs), 'utf8')
    await writeFile(path.join(outputDirectory, 'permission.json'), `${JSON.stringify(report.permission, null, 2)}\n`, 'utf8')
    process.stdout.write(`Merged benchmark report: ${outputDirectory}\n`)
  } catch (error) {
    process.stderr.write(`Merge failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
