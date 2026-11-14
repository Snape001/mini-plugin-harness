import { runBenchmark, evaluationGroups } from '../src/evaluation/runner.js'
import type { EvaluationGroup } from '../src/evaluation/metrics.js'
import { resume20Tasks } from '../src/evaluation/benchmark.js'

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
    `Tasks: ${resume20Tasks.map((task) => task.id).join(', ')}`,
    `Groups: ${evaluationGroups.join(', ')}`,
    '',
    'Options: --suite <resume-20-v1> --tasks <comma-separated IDs> --groups <comma-separated groups> --repetitions <1..20>',
    '        --max-agent-rounds <1..60> --timeout-ms <up to 15 minutes> --output <directory>',
  ].join('\n') + '\n')
} else {
  const suite = value('--suite') ?? 'resume-20-v1'
  const tasks = value('--tasks')?.split(',').filter(Boolean)
  const groups = value('--groups')?.split(',').filter(Boolean) as EvaluationGroup[] | undefined
  const repetitions = value('--repetitions') === undefined ? 1 : Number(value('--repetitions'))
  const maxAgentRounds = value('--max-agent-rounds') === undefined ? value('--max-model-calls') === undefined ? undefined : Number(value('--max-model-calls')) : Number(value('--max-agent-rounds'))
  const timeoutMs = value('--timeout-ms') === undefined ? undefined : Number(value('--timeout-ms'))
  const outputDirectory = value('--output')
  try {
    const result = await runBenchmark({ suite, tasks, groups, repetitions, maxAgentRounds, timeoutMs, outputDirectory })
    process.stdout.write(`${result.markdown}\nReports: ${result.outputDirectory}\n`)
    const failures = result.report.runs.filter((run) => run.status !== 'passed').length
    process.exitCode = failures || result.report.permission.status === 'failed' ? 1 : 0
  } catch (error) {
    process.stderr.write(`Benchmark failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
