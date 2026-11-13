import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { load } from 'js-yaml'
import { z } from 'zod'

const pluginNames = ['logger', 'hooks', 'permission', 'llm', 'tools', 'mcp', 'skills', 'session', 'prompt', 'agent'] as const
const configuredPlugins = pluginNames.filter((name) => name !== 'mcp')
const toolPermissionSchema = z.enum(['read', 'write', 'dangerous'])
const mcpServerBase = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
  permission: toolPermissionSchema.optional(),
  toolPermissions: z.record(z.string().min(1), toolPermissionSchema).default({}),
})
const mcpServerSchema = z.discriminatedUnion('transport', [
  mcpServerBase.extend({
    transport: z.literal('stdio'),
    command: z.string().trim().min(1),
    args: z.array(z.string()).default([]),
    cwd: z.string().min(1).optional(),
  }).strict(),
  mcpServerBase.extend({
    transport: z.literal('http'),
    url: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'must use HTTP or HTTPS'),
    bearerTokenEnv: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
  }).strict(),
])
const mcpSchema = z.object({
  servers: z.array(mcpServerSchema).default([]),
  connectTimeoutMs: z.number().int().min(100).max(300_000).default(15_000),
  reconnectProbeMs: z.number().int().min(10).max(600_000).default(30_000),
}).strict().default({ servers: [], connectTimeoutMs: 15_000, reconnectProbeMs: 30_000 }).superRefine((value, context) => {
  const ids = new Set<string>()
  value.servers.forEach((server, index) => {
    if (ids.has(server.id)) context.addIssue({ code: 'custom', path: ['servers', index, 'id'], message: `duplicate MCP server id "${server.id}"` })
    ids.add(server.id)
  })
})

const permissionsSchema = z.object({
  allow: z.array(z.string().min(1)).default([]),
  deny: z.array(z.string().min(1)).default([]),
  defaultWrite: z.enum(['deny', 'allow']).default('deny'),
  approvalTimeoutMs: z.number().int().min(1).max(300_000).default(30_000),
}).strict().default({ allow: [], deny: [], defaultWrite: 'deny', approvalTimeoutMs: 30_000 })

export const configSchema = z.object({
  projectRoot: z.string().default('.'),
  skillsDir: z.string().default('./skills'),
  skills: z.object({
    maxSkillTokens: z.number().int().min(64).max(8192).default(1200),
    maxTotalTokens: z.number().int().min(64).max(16384).default(2400),
  }).strict().default({ maxSkillTokens: 1200, maxTotalTokens: 2400 }),
  promptsDir: z.string().default('./prompts'),
  prompts: z.object({
    disabled: z.array(z.string()).default([]),
    versions: z.record(z.string(), z.string()).default({}),
    variables: z.record(z.string(), z.string()).default({}),
    selector: z.enum(['rules', 'llm']).default('rules'),
    taskTypes: z.array(z.object({ type: z.string().min(1), keywords: z.array(z.string()).default([]), regex: z.string().optional() }).strict()).default([]),
  }).strict().default({ disabled: [], versions: {}, variables: {}, selector: 'rules', taskTypes: [] }),
  maxIterations: z.number().int().min(1).max(100).default(8),
  maxTaskIterations: z.number().int().min(1).max(10_000).default(100),
  toolRetries: z.number().int().min(0).max(5).default(1),
  model: z.string().min(1).default('deepseek-flash'),
  apiBaseUrl: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'must use HTTP or HTTPS').default('https://api.deepseek.com'),
  requestTimeoutMs: z.number().int().min(1_000).max(600_000).default(120_000),
  sessionDb: z.string().default('./.miniharness/sessions.sqlite'),
  contextInputTokens: z.number().int().min(1024).default(16_000),
  contextOutputReserve: z.number().int().min(128).default(2_048),
  context: z.object({
    softThreshold: z.number().min(0.5).max(1).default(0.8),
    layers: z.object({
      L0: z.object({ initial: z.number().int().min(64).default(6000), max: z.number().int().min(64).default(12000) }).strict().default({ initial: 6000, max: 12000 }),
      L1: z.object({ initial: z.number().int().min(32).default(1800), max: z.number().int().min(32).default(4000) }).strict().default({ initial: 1800, max: 4000 }),
      L2: z.object({ initial: z.number().int().min(32).default(900), max: z.number().int().min(32).default(2400) }).strict().default({ initial: 900, max: 2400 }),
      L3: z.object({ initial: z.number().int().min(32).default(450), max: z.number().int().min(32).default(1200) }).strict().default({ initial: 450, max: 1200 }),
    }).strict().default({ L0: { initial: 6000, max: 12000 }, L1: { initial: 1800, max: 4000 }, L2: { initial: 900, max: 2400 }, L3: { initial: 450, max: 1200 } }),
  }).strict().default({ softThreshold: 0.8, layers: { L0: { initial: 6000, max: 12000 }, L1: { initial: 1800, max: 4000 }, L2: { initial: 900, max: 2400 }, L3: { initial: 450, max: 1200 } } }),
  plugins: z.array(z.enum(pluginNames)).min(1).default([...configuredPlugins]),
  permissions: permissionsSchema,
  mcp: mcpSchema,
}).strict().superRefine((config, context) => {
  if (config.maxTaskIterations < config.maxIterations) {
    context.addIssue({ code: 'custom', path: ['maxTaskIterations'], message: 'must be greater than or equal to maxIterations' })
  }
  if (config.skills.maxTotalTokens < config.skills.maxSkillTokens) {
    context.addIssue({ code: 'custom', path: ['skills', 'maxTotalTokens'], message: 'must be greater than or equal to maxSkillTokens' })
  }
  if (config.contextOutputReserve >= config.contextInputTokens) {
    context.addIssue({ code: 'custom', path: ['contextOutputReserve'], message: 'must be smaller than contextInputTokens' })
  }
  for (const [level, budget] of Object.entries(config.context.layers)) {
    if (budget.initial > budget.max) context.addIssue({ code: 'custom', path: ['context', 'layers', level], message: 'initial must be no greater than max' })
  }
  const seen = new Set<string>()
  config.plugins.forEach((name, index) => {
    if (seen.has(name)) context.addIssue({ code: 'custom', path: ['plugins', index], message: `duplicate plugin "${name}"` })
    seen.add(name)
  })
})

export type RuntimeConfig = z.infer<typeof configSchema>

export async function loadConfig(filePath: string): Promise<RuntimeConfig> {
  let source: string
  try {
    source = await readFile(filePath, 'utf8')
  } catch (error) {
    throw new Error(`Cannot read config ${filePath}: ${(error as Error).message}`)
  }
  let parsed: unknown
  try {
    parsed = load(source)
  } catch (error) {
    throw new Error(`Invalid YAML in ${filePath}: ${(error as Error).message}`)
  }
  const result = configSchema.safeParse(parsed)
  if (!result.success) throw new Error(`Invalid config: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
  const configDir = path.dirname(path.resolve(filePath))
  return {
    ...result.data,
    projectRoot: path.resolve(configDir, result.data.projectRoot),
    skillsDir: path.resolve(configDir, result.data.skillsDir),
    promptsDir: path.resolve(configDir, result.data.promptsDir),
    sessionDb: path.resolve(configDir, result.data.sessionDb),
    mcp: {
      ...result.data.mcp,
      servers: result.data.mcp.servers.map((server) => server.transport === 'stdio' && server.cwd
        ? { ...server, cwd: path.resolve(configDir, server.cwd) }
        : server),
    },
  }
}
