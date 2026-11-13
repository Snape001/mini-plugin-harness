import { runBenchmark, evaluationGroups } from '../src/evaluation/runner.js'
import type { EvaluationGroup } from '../src/evaluation/metrics.js'
import { benchmarkTasks, candidateCommonTasks, candidateCoreTasks } from '../src/evaluation/benchmark.js'

function value(name: string) {
  const index = process.argv.indexOf(name)
  if (index >= 0) return process.argv[index + 1]
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`))
  return inline?.slice(name.length + 1)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write([
    'Usage: pnpm eval:benchmark [options]',
    '',
    `Tasks: ${[...benchmarkTasks.map((task) => task.id), 'fault-recovery', 'mcp-recovery'].join(', ')}`,
    `Groups: ${evaluationGroups.join(', ')}`,
    '',
    'Options: --tasks <comma-separated IDs> --groups <comma-separated groups> --repetitions <1..20>',
    '        --max-agent-rounds <1..60> --timeout-ms <up to 15 minutes> --output <directory>',
    '        --candidate-calibration (all 12 candidate tasks, one run, Baseline group unless --groups is supplied)',
    '        --candidate-core (9 capability candidates; default Baseline+Full, 3 repetitions unless overridden)',
  ].join('\n') + '\n')
} else {
  const calibration = process.argv.includes('--candidate-calibration')
  const core = process.argv.includes('--candidate-core')
  const tasks = value('--tasks')?.split(',').filter(Boolean)
    ?? (core ? candidateCoreTasks.map((task) => task.id) : calibration ? candidateCommonTasks.map((task) => task.id) : undefined)
  const groups = value('--groups')?.split(',').filter(Boolean) as EvaluationGroup[] | undefined
  const repetitions = value('--repetitions') === undefined ? core ? 3 : calibration ? 1 : undefined : Number(value('--repetitions'))
  const maxAgentRounds = value('--max-agent-rounds') === undefined ? value('--max-model-calls') === undefined ? undefined : Number(value('--max-model-calls')) : Number(value('--max-agent-rounds'))
  const timeoutMs = value('--timeout-ms') === undefined ? undefined : Number(value('--timeout-ms'))
  const outputDirectory = value('--output')
  try {
    const selectedGroups = groups ?? (core ? ['baseline', 'full'] as EvaluationGroup[] : calibration ? ['baseline'] as EvaluationGroup[] : undefined)
    const result = await runBenchmark({ tasks, groups: selectedGroups, repetitions, maxAgentRounds, timeoutMs, outputDirectory })
    process.stdout.write(`${result.markdown}\nReports: ${result.outputDirectory}\n`)
    const failures = result.report.runs.filter((run) => run.status !== 'passed').length
    process.exitCode = failures || result.report.permission.status === 'failed' ? 1 : 0
  } catch (error) {
    process.stderr.write(`Benchmark failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
