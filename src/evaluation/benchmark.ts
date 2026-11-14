import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ToolRegistration } from '../types.js'

export interface BenchmarkStep {
  prompt: string
  blockedTools?: string[]
  verify(root: string, answer: string, calledTools?: string[]): Promise<{ passed: boolean; detail: string }>
  extraTools?: (root: string) => ToolRegistration[]
}

export interface BenchmarkTask {
  id: string
  category: string
  fixture: string
  steps: BenchmarkStep[]
  contextBudget?: number
  suite?: 'common' | 'skills' | 'prompt' | 'context' | 'mcp'
  candidateFamily?: 'skills' | 'prompt' | 'context' | 'recovery'
  capability?: 'control' | 'context' | 'skills' | 'prompt' | 'recovery' | 'mcp'
  scored?: boolean
  version?: string
  expectedSkills?: string[]
  fixtureFiles?: Record<string, string>
}

const contains = (answer: string, ...values: string[]) => values.every((value) => answer.toLowerCase().includes(value.toLowerCase()))
const runNode = promisify(execFile)
const pass = (passed: boolean, detail: string) => ({ passed, detail })
async function restrictedNode(root: string, script: string) {
  const { stdout } = await runNode(process.execPath, ['--permission', `--allow-fs-read=${root}`, '--input-type=module', '-e', script], {
    cwd: root, timeout: 10_000, maxBuffer: 256_000,
    env: { SystemRoot: process.env.SystemRoot ?? '', PATH: path.dirname(process.execPath) },
  })
  return stdout
}
async function probeModule(root: string, relative: string, expressions: string[]): Promise<unknown[]> {
  const file = path.resolve(root, relative)
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('Module escapes benchmark workspace')
  const script = `const mod = await import(${JSON.stringify(pathToFileURL(file).href)}); process.stdout.write(JSON.stringify([${expressions.join(',')}]))`
  return JSON.parse(await restrictedNode(root, script)) as unknown[]
}
async function runTestFile(root: string, relative: string) {
  const file = path.resolve(root, relative)
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('Test escapes benchmark workspace')
  return restrictedNode(root, `await import(${JSON.stringify(pathToFileURL(file).href)})`)
}

export const benchmarkTasks: BenchmarkTask[] = [
  {
    id: 'locate-constant', category: 'code-understanding', fixture: 'locate',
    steps: [{
      prompt: 'Find the default timeout constant in the source. Explain its exact name and value, citing the file path.',
      async verify(_root, answer) { return { passed: contains(answer, 'DEFAULT_TIMEOUT_MS', '2500'), detail: 'Answer must identify DEFAULT_TIMEOUT_MS as 2500 ms.' } },
    }],
  },
  {
    id: 'single-file-backoff-fix', category: 'bug-fix', fixture: 'single-fix',
    steps: [{
      prompt: 'Fix src/backoff.mjs so backoffMs(attempt) uses exponential backoff: attempt 1 returns 100, attempt 2 returns 200, and attempt 4 returns 800 milliseconds. Keep the change in this file and explain what changed.',
      async verify(root) {
        const values = await probeModule(root, 'src/backoff.mjs', ['mod.backoffMs(1)', 'mod.backoffMs(2)', 'mod.backoffMs(4)'])
        const passed = JSON.stringify(values) === '[100,200,800]'
        return { passed, detail: passed ? 'backoffMs passed the three executable cases.' : 'backoffMs must return 100, 200, and 800 for attempts 1, 2, and 4.' }
      },
    }],
  },
  {
    id: 'multi-file-port-fix', category: 'bug-fix', fixture: 'multi-fix',
    steps: [{
      prompt: 'Update the port configuration so the default port is 8080. resolvePort must return 8080 for an empty value and 4321 for the string "4321". Make the configuration and server files consistent.',
      async verify(root) {
        const config = await probeModule(root, 'src/config.mjs', ['mod.DEFAULT_PORT'])
        const server = await probeModule(root, 'src/server.mjs', ["mod.resolvePort('')", "mod.resolvePort('4321')"])
        const passed = config[0] === 8080 && JSON.stringify(server) === '[8080,4321]'
        return { passed, detail: passed ? 'Default and explicit port cases passed.' : 'Expected DEFAULT_PORT=8080 and resolvePort(""/"4321") to return 8080/4321.' }
      },
    }],
  },
  {
    id: 'cross-task-handoff', category: 'long-running', fixture: 'cross-task',
    steps: [
      {
        prompt: 'Read ops-note.txt and report the exact deploy checklist handoff code. Keep the response concise.',
        async verify(_root, answer) { return { passed: contains(answer, 'ORCHID-417'), detail: 'The first task must locate the handoff code.' } },
      },
      {
        prompt: 'Create handoff.txt containing the exact deploy checklist handoff code established in the previous task. Do not reread ops-note.txt. Then confirm the code.',
        async verify(root, answer) {
          const file = await readFile(path.join(root, 'handoff.txt'), 'utf8').catch(() => '')
          const passed = file.trim() === 'ORCHID-417' && contains(answer, 'ORCHID-417')
          return { passed, detail: 'handoff.txt must contain the code carried over from the prior task.' }
        },
      },
    ],
  },
  {
    id: 'context-window-recall', category: 'long-running', fixture: 'context-window', contextBudget: 10_000,
    steps: [
      ...Array.from({ length: 5 }, (_, index): BenchmarkStep => ({
        prompt: `Read context/page-${index + 1}.txt and report its unique marker exactly.`,
        async verify(_root, answer) {
          const marker = `PAGE-${index + 1}-JUNIPER-${index + 1}62`
          return { passed: contains(answer, marker), detail: `Task ${index + 1} must return ${marker}.` }
        },
      })),
      {
        prompt: 'Without using tools, what exact marker was found in context/page-1.txt in the first task? Write it to recalled-marker.txt and include it in your response.',
        async verify(root, answer) {
          const expected = 'PAGE-1-JUNIPER-162'
          const file = await readFile(path.join(root, 'recalled-marker.txt'), 'utf8').catch(() => '')
          const passed = file.trim() === expected && contains(answer, expected)
          return { passed, detail: 'The first task marker must survive context compaction and be written to recalled-marker.txt.' }
        },
      },
    ],
  },
  {
    id: 'transient-tool-failure', category: 'engineering', fixture: 'tool-failure',
    steps: [{
      prompt: 'Use the lookup_reference tool, which has one transient failure, to get the reference value. Write the returned value to lookup-result.txt and confirm it.',
      async verify(root, answer) {
        const file = await readFile(path.join(root, 'lookup-result.txt'), 'utf8').catch(() => '')
        const passed = file.trim() === 'MAPLE-208' && contains(answer, 'MAPLE-208')
        return { passed, detail: 'The tool failure should be handled and MAPLE-208 written to lookup-result.txt.' }
      },
      extraTools: () => {
        let calls = 0
        const registration: ToolRegistration = {
          definition: { name: 'lookup_reference', description: 'Look up the reference value. The first invocation can fail transiently; retry or call again after an error.', permission: 'read', parameters: { type: 'object', additionalProperties: false } },
          validate: () => ({}),
          execute: () => {
            calls++
            if (calls === 1) throw new Error('Injected transient fixture failure')
            return { content: [{ type: 'text', text: 'MAPLE-208' }], isError: false }
          },
        }
        return [registration]
      },
    }],
  },
  {
    id: 'mcp-discovery', category: 'mcp-special', suite: 'mcp', fixture: 'mcp',
    steps: [{
      prompt: 'Use the connected MCP tool that looks up the release hint. Write its exact result to mcp-result.txt and confirm it.',
      async verify(root, answer) {
        const file = await readFile(path.join(root, 'mcp-result.txt'), 'utf8').catch(() => '')
        const passed = file.trim() === 'MCP-CEDAR-931' && contains(answer, 'MCP-CEDAR-931')
        return { passed, detail: 'The discovered MCP tool must return MCP-CEDAR-931 and the value must be written to mcp-result.txt.' }
      },
    }],
  },
  {
    id: 'module-dependencies', category: 'code-understanding', fixture: 'generated',
    fixtureFiles: {
      'src/start.mjs': "import { processOrder } from './orders.mjs'\nexport const start = (order) => processOrder(order)\n",
      'src/orders.mjs': "import { normalizePrice } from './prices.mjs'\nexport const processOrder = (order) => normalizePrice(order.price)\n",
      'src/prices.mjs': 'export const normalizePrice = (value) => Math.round(value * 100) / 100\n',
    },
    steps: [{ prompt: 'Trace the source module dependencies from src/start.mjs through the price helper. Name each file in order and explain which symbol is imported.',
      async verify(_root, answer) { return pass(contains(answer, 'start.mjs', 'orders.mjs', 'prices.mjs', 'processOrder', 'normalizePrice') && answer.indexOf('start.mjs') < answer.indexOf('orders.mjs') && answer.indexOf('orders.mjs') < answer.indexOf('prices.mjs'), 'Must identify the ordered imports and both symbols.') } }],
  },
  {
    id: 'call-chain-trace', category: 'code-understanding', fixture: 'generated',
    fixtureFiles: {
      'src/entry.mjs': "import { dispatch } from './router.mjs'\nexport const handle = (event) => dispatch(event)\n",
      'src/router.mjs': "import { persist } from './store.mjs'\nexport const dispatch = (event) => persist(event.id)\n",
      'src/store.mjs': 'export const persist = (id) => `saved:${id}`\n',
    },
    steps: [{ prompt: 'Trace handle({id:"A7"}) through the call chain and report the functions in order and exact return value.',
      async verify(_root, answer) { return pass(contains(answer, 'handle', 'dispatch', 'persist', 'saved:A7') && answer.indexOf('handle') < answer.indexOf('dispatch') && answer.indexOf('dispatch') < answer.indexOf('persist'), 'Must trace handle → dispatch → persist and saved:A7.') } }],
  },
  {
    id: 'boundary-condition-fix', category: 'bug-fix', fixture: 'generated',
    fixtureFiles: { 'src/page.mjs': 'export const pageIndex = (requested, count) => Math.min(requested, count - 1)\n' },
    steps: [{ prompt: 'Fix src/page.mjs so pageIndex returns 0 for empty collections and negative requests, clamps requests above the last index, and keeps valid indices.',
      async verify(root) { const values = await probeModule(root, 'src/page.mjs', ['mod.pageIndex(-2,4)', 'mod.pageIndex(0,0)', 'mod.pageIndex(9,4)', 'mod.pageIndex(2,4)']); return pass(JSON.stringify(values) === '[0,0,3,2]', 'Boundary cases: negative, empty, above-range, and valid index.') } }],
  },
  {
    id: 'new-function', category: 'feature-development', fixture: 'generated',
    fixtureFiles: { 'src/labels.mjs': 'export const displayName = (name) => name.trim()\n' },
    steps: [{ prompt: 'Add export slugify(name) to src/labels.mjs. Trim, lowercase, replace each run of non-alphanumeric characters with one hyphen, and remove leading/trailing hyphens.',
      async verify(root) { const values = await probeModule(root, 'src/labels.mjs', ['typeof mod.slugify', "mod.slugify?.('  Hello, World!  ')", "mod.slugify?.('A___B')", "mod.slugify?.('---')", "mod.slugify?.('One')"]); return pass(JSON.stringify(values) === '["function","hello-world","a-b","","one"]', 'slugify must satisfy four executable cases.') } }],
  },
  {
    id: 'configuration-change', category: 'feature-development', fixture: 'generated',
    fixtureFiles: { 'src/settings.json': '{"retryLimit":2,"mode":"safe"}\n', 'src/client.mjs': "import settings from './settings.json' with { type: 'json' }\nexport const retries = () => settings.retryLimit\n" },
    steps: [{ prompt: 'Change the retry limit in src/settings.json to 4. Keep mode safe and client.mjs using the configured value.',
      async verify(root) { const settings = JSON.parse(await readFile(path.join(root, 'src/settings.json'), 'utf8')) as { retryLimit: number; mode: string }; const values = await probeModule(root, 'src/client.mjs', ['mod.retries()']); return pass(settings.retryLimit === 4 && settings.mode === 'safe' && values[0] === 4, 'Config and executable client must both use retryLimit=4.') } }],
  },
  {
    id: 'unit-test-addition', category: 'feature-development', fixture: 'generated', scored: false,
    fixtureFiles: { 'src/math.mjs': 'export const isEven = (n) => Number.isInteger(n) && n % 2 === 0\n', 'tests/.keep': '' },
    steps: [{ prompt: 'Add tests/math.test.mjs using node:test and node:assert/strict for isEven. Cover a positive even integer, an odd integer, zero, and a non-integer. Do not change src/math.mjs. Run it with the run_node_tests tool.',
      async verify(root) { const source = await readFile(path.join(root, 'tests/math.test.mjs'), 'utf8').catch(() => ''); const original = await readFile(path.join(root, 'src/math.mjs'), 'utf8'); if (!source.includes('isEven') || !source.includes('node:test') || !source.includes('node:assert/strict') || !source.includes('0') || !source.includes('2') || !source.includes('3') || !source.includes('2.5') || original !== 'export const isEven = (n) => Number.isInteger(n) && n % 2 === 0\n') return pass(false, 'Tests must cover four cases without altering implementation.'); try { const stdout = await runTestFile(root, 'tests/math.test.mjs'); return pass(/^[#ℹ]\s*pass\s+[4-9]$/m.test(stdout) && /^[#ℹ]\s*fail\s+0$/m.test(stdout), 'Four passing node:test cases are required.') } catch { return pass(false, 'node:test suite must pass.') } } }],
  },
  {
    id: 'code-review', category: 'engineering', fixture: 'generated',
    fixtureFiles: { 'src/auth.mjs': "export const allowed = (user, resource) => user.isAdmin || resource.ownerId == user.id\nexport const audit = (user) => console.log('token=' + user.token)\n" },
    steps: [{ prompt: 'Review src/auth.mjs without editing it. Identify the security issue in audit and the unsafe equality check in allowed. Give a concrete fix for each.',
      async verify(root, answer) { const source = await readFile(path.join(root, 'src/auth.mjs'), 'utf8'); return pass(source.includes("console.log('token='") && contains(answer, 'token', 'log') && (answer.includes('===') || contains(answer, 'strict equality', 'type coercion')), 'Review must identify token logging and loose equality, with fixes; source must stay unchanged.') } }],
  },
  {
    id: 'test-failure-analysis', category: 'engineering', fixture: 'generated',
    fixtureFiles: { 'src/discount.mjs': 'export const discounted = (price, rate) => price * (1 - rate)\n', 'tests/discount.test.mjs': "import { test } from 'node:test'\nimport { strictEqual } from 'node:assert'\nimport { discounted } from '../src/discount.mjs'\ntest('percent discount', () => strictEqual(discounted(100, 20), 80))\n" },
    steps: [{ prompt: 'Analyze why node --test fails for tests/discount.test.mjs. Do not edit files. Explain the mismatch between percentage and fractional rate and the minimal fix.',
      async verify(root, answer) { const source = await readFile(path.join(root, 'src/discount.mjs'), 'utf8'); return pass(source === 'export const discounted = (price, rate) => price * (1 - rate)\n' && contains(answer, '20', '100') && /fraction|percentage|divide|\/\s*100|0\.2/i.test(answer), 'Must diagnose percent-versus-fraction mismatch without changing code.') } }],
  },
  {
    id: 'continuous-modification', category: 'long-running', fixture: 'generated',
    fixtureFiles: { 'src/queue.mjs': 'export const capacity = () => 2\nexport const label = () => "old"\n' },
    steps: [
      { prompt: 'In src/queue.mjs change capacity() to return 5. Keep label() as it is.', async verify(root) { const values = await probeModule(root, 'src/queue.mjs', ['mod.capacity()', 'mod.label()']); return pass(JSON.stringify(values) === '[5,"old"]', 'First change must update only capacity.') } },
      { prompt: 'Continue the previous modification: change label() to return "ready" while keeping capacity() at 5.', async verify(root) { const values = await probeModule(root, 'src/queue.mjs', ['mod.capacity()', 'mod.label()']); return pass(JSON.stringify(values) === '[5,"ready"]', 'Both sequential changes must remain valid.') } },
    ],
  },
]

benchmarkTasks.push({ ...benchmarkTasks.find((task) => task.id === 'mcp-discovery')!, id: 'mcp-call', suite: 'mcp', steps: [{
  prompt: 'Use the connected MCP echo tool with code "ALDER-604". Write the returned value to mcp-echo.txt and confirm it.',
  async verify(root, answer) { const file = await readFile(path.join(root, 'mcp-echo.txt'), 'utf8').catch(() => ''); return pass(file.trim() === 'echo:ALDER-604' && contains(answer, 'echo:ALDER-604'), 'Must call discovered MCP echo tool and persist its exact result.') },
}] })
benchmarkTasks.push(
  { ...benchmarkTasks.find((task) => task.id === 'cross-task-handoff')!, id: 'context-handoff', suite: 'context' },
  { ...benchmarkTasks.find((task) => task.id === 'context-window-recall')!, id: 'context-compression', suite: 'context', contextBudget: 4096 },
)

export const candidateCommonTasks: BenchmarkTask[] = [
  {
    id: 'candidate-skills-boundary-audit', category: 'candidate-skills', candidateFamily: 'skills', fixture: 'generated', expectedSkills: ['bug-investigation', 'targeted-code-fix'],
    fixtureFiles: { 'src/window.mjs': 'export const windowEnd = (start, size, length) => Math.min(start + size, length)\n' },
    steps: [{ prompt: 'Fix src/window.mjs so windowEnd handles negative starts as zero, non-positive sizes as an empty window, and lengths below the start without returning a value above the length. Preserve the ordinary case windowEnd(2,3,9) = 5.', async verify(root) { const result = await probeModule(root, 'src/window.mjs', ['mod.windowEnd(-3,2,9)', 'mod.windowEnd(2,0,9)', 'mod.windowEnd(7,3,5)', 'mod.windowEnd(2,3,9)']); return pass(JSON.stringify(result) === '[2,2,5,5]', 'All four independent boundary cases must pass.') } }],
  },
  {
    id: 'candidate-prompt-requirement-revision', category: 'candidate-prompt', candidateFamily: 'prompt', fixture: 'generated',
    fixtureFiles: { 'src/retry.mjs': 'export const delay = (attempt) => 100 * attempt\n' },
    steps: [
      { prompt: 'Initial requirement: update src/retry.mjs so delay(attempt) returns 100, 200, and 400 for attempts 1, 2, and 4. Keep the change limited to this module.', async verify(root) { const values = await probeModule(root, 'src/retry.mjs', ['mod.delay(1)', 'mod.delay(2)', 'mod.delay(4)']); return pass(JSON.stringify(values) === '[100,200,400]', 'Initial retry behavior must pass.') } },
      { prompt: 'Requirement change: retries now use exponential backoff, so attempt 4 must return 800. Keep attempt 1 at 100 and attempt 2 at 200, and preserve the single-module scope.', async verify(root) { const values = await probeModule(root, 'src/retry.mjs', ['mod.delay(1)', 'mod.delay(2)', 'mod.delay(4)']); return pass(JSON.stringify(values) === '[100,200,800]', 'Revised exponential behavior must replace the earlier linear behavior.') } },
    ],
  },
  { id: 'candidate-recovery-partial-write', category: 'candidate-recovery', candidateFamily: 'recovery', fixture: 'generated', fixtureFiles: {}, steps: [] },
]

export const pluginGatedTasks: BenchmarkTask[] = [
  {
    id: 'plugin-skills-release-audit', category: 'engineering', fixture: 'generated', suite: 'common',
    capability: 'skills', scored: true, version: 'resume-20-v1', expectedSkills: ['safe-release'],
    fixtureFiles: { 'release.json': '{"channel":"nightly","rollbackPlan":""}\n' },
    steps: [{
      prompt: 'The safe-release skill is already loaded in the conversation; apply it without searching for a skill file. Audit release.json and write audit.md with the policy verdict. Do not modify release.json or any other file.',
      async verify(root) {
        const audit = await readFile(path.join(root, 'audit.md'), 'utf8').catch(() => '')
        let release: { channel?: string; rollbackPlan?: string } = {}
        try { release = JSON.parse(await readFile(path.join(root, 'release.json'), 'utf8')) as typeof release } catch { /* invalid JSON */ }
        const untouched = release.channel === 'nightly' && release.rollbackPlan === ''
        return pass(contains(audit, 'POLICY-SR-7', 'BLOCKED') && untouched, 'audit.md must record POLICY-SR-7/BLOCKED for the untouched nightly manifest.')
      },
    }],
  },
  {
    id: 'plugin-context-cross-task-seal', category: 'long-running', fixture: 'generated', suite: 'common',
    capability: 'context', scored: true, version: 'resume-20-v1', contextBudget: 8192,
    fixtureFiles: { 'incident.log': 'Incident review\nSEAL: AMBER-9-QUARRY\nOwner: release\n' },
    steps: [
      { prompt: 'Read incident.log and write handoff.txt containing the incident seal. Keep the exact seal text.', async verify(root) { const handoff = await readFile(path.join(root, 'handoff.txt'), 'utf8').catch(() => ''); return pass(contains(handoff, 'SEAL: AMBER-9-QUARRY'), 'handoff.txt must contain SEAL: AMBER-9-QUARRY.') } },
      { prompt: 'Do not read, search, or list files. Using the earlier task context, write release.md with the seal and DECISION: HOLD.', blockedTools: ['read_file', 'search_text', 'list_files', 'run_shell', 'run_node_tests'], async verify(root) { const release = await readFile(path.join(root, 'release.md'), 'utf8').catch(() => ''); return pass(contains(release, 'SEAL: AMBER-9-QUARRY', 'DECISION: HOLD'), 'release.md must recall the earlier seal without rereading tools.') } },
    ],
  },
  {
    id: 'plugin-prompt-repair-contract', category: 'bug-fix', fixture: 'generated', suite: 'common',
    capability: 'prompt', scored: true, version: 'resume-20-v1',
    fixtureFiles: {
      'src/calc.mjs': 'export const add = (a, b) => a - b\n',
      'src/calc.test.mjs': "import { test } from 'node:test'\nimport { strictEqual } from 'node:assert/strict'\nimport { add } from './calc.mjs'\ntest('adds', () => strictEqual(add(2, 3), 5))\n",
    },
    steps: [{
      prompt: 'Fix the failing test under the repair-contract protocol. Keep the change in src/calc.mjs.',
      async verify(root) {
        try { await runTestFile(root, 'src/calc.test.mjs') } catch { return pass(false, 'The existing node:test suite must pass.') }
        const plan = await readFile(path.join(root, 'repair-plan.md'), 'utf8').catch(() => '')
        const verification = await readFile(path.join(root, 'verification.md'), 'utf8').catch(() => '')
        return pass(contains(plan, 'CONTRACT-PR-4', 'ROOT_CAUSE:', 'NEXT_ACTION:') && contains(verification, 'CONTRACT-PR-4', 'PASS: yes'), 'repair-plan.md and verification.md must satisfy the repair-contract protocol.')
      },
    }],
  },
]

benchmarkTasks.push(...candidateCommonTasks, ...pluginGatedTasks)

const legacyCommonTasks = benchmarkTasks.filter((task) => !task.suite && !task.candidateFamily && !task.version)
const resume20CandidateTasks = candidateCommonTasks.filter((task) => [
  'candidate-skills-boundary-audit',
  'candidate-prompt-requirement-revision',
  'candidate-recovery-partial-write',
].includes(task.id))

const capabilityFor = (task: BenchmarkTask): BenchmarkTask['capability'] => {
  if (task.candidateFamily) return task.candidateFamily
  if (task.id.includes('context') || task.id.includes('handoff') || task.id.includes('recall')) return 'context'
  return 'control'
}

export const resume20CoreTasks: BenchmarkTask[] = [
  ...legacyCommonTasks.filter((task) => task.id !== 'unit-test-addition').map((task) => ({ ...task, capability: capabilityFor(task), scored: true, version: 'resume-20-v1' })),
  ...resume20CandidateTasks.map((task) => ({ ...task, capability: task.candidateFamily, scored: true, version: 'resume-20-v1' })),
  ...pluginGatedTasks,
]

export const resume20McpTasks: BenchmarkTask[] = (['mcp-call', 'mcp-discovery'] as const).map((id) => {
  const task = benchmarkTasks.find((item) => item.id === id)
  if (!task) throw new Error(`Missing MCP task: ${id}`)
  return { ...task, capability: 'mcp', scored: false, version: 'resume-20-v1' }
})

export const resume20Tasks: BenchmarkTask[] = [...resume20CoreTasks, ...resume20McpTasks]

export const commonBenchmarkTasks = benchmarkTasks.filter((task) => !task.suite)
export const benchmarkVersion = '2026-11-v7-plugin-gated'

export async function prepareFixture(task: BenchmarkTask, root: string, fixtureRoot: string) {
  const destination = path.join(root, task.fixture)
  await mkdir(destination, { recursive: true })
  if (task.fixtureFiles) {
    for (const [name, content] of Object.entries(task.fixtureFiles)) {
      if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw new Error(`Unsafe fixture path: ${name}`)
      const file = path.join(root, name)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, content, 'utf8')
    }
    return
  }
  if (task.fixture === 'context-window') {
    const directory = path.join(root, 'context')
    await mkdir(directory, { recursive: true })
    const filler = 'This page contains deployment background, ownership notes, routine maintenance details, and archive references. '.repeat(22)
    for (let index = 1; index <= 5; index++) {
      const marker = `PAGE-${index}-JUNIPER-${index}62`
      await writeFile(path.join(directory, `page-${index}.txt`), `${filler}\nUnique marker: ${marker}\n${filler}`, 'utf8')
    }
    return
  }
  const source = path.join(fixtureRoot, task.fixture)
  for (const entry of await readdir(source)) await cp(path.join(source, entry), path.join(root, entry), { recursive: true, force: true })
}
