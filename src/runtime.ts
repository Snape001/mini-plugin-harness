import { Context } from 'cordis'
import { stat } from 'node:fs/promises'
import type { RuntimeConfig } from './config.js'
import { loggerPlugin } from './plugins/logger.js'
import { hooksPlugin } from './plugins/hooks.js'
import { createLlmPlugin } from './plugins/llm.js'
import { createToolsPlugin } from './plugins/tools.js'
import { createAgentPlugin } from './plugins/agent.js'
import { createSkillsPlugin } from './plugins/skills.js'
import { createPermissionPlugin } from './plugins/permission.js'
import { createSessionPlugin } from './plugins/session.js'
import { createMcpPlugin } from './plugins/mcp.js'
import type { ApprovalHandler } from './types.js'

export async function createRuntime(config: RuntimeConfig, fetchImpl?: typeof fetch, approvalHandler?: ApprovalHandler) {
  if (config.plugins.includes('agent')) {
    for (const dependency of ['llm', 'tools', 'hooks', 'skills', 'session'] as const) {
      if (!config.plugins.includes(dependency)) throw new Error(`Plugin "agent" requires "${dependency}" in the plugins list`)
    }
  }
  if (config.plugins.includes('tools')) {
    for (const dependency of ['hooks', 'permission'] as const) {
      if (!config.plugins.includes(dependency)) throw new Error(`Plugin "tools" requires "${dependency}" in the plugins list`)
    }
  }
  if (config.plugins.includes('mcp') && !config.plugins.includes('tools')) {
    throw new Error('Plugin "mcp" requires "tools" in the plugins list')
  }
  if (config.plugins.includes('tools')) {
    try {
      if (!(await stat(config.projectRoot)).isDirectory()) throw new Error('not a directory')
    } catch (error) {
      throw new Error(`Invalid projectRoot "${config.projectRoot}": ${(error as Error).message}`)
    }
  }
  const ctx = new Context()
  type ScopeState = { error?: Error | null; tasks?: Set<Promise<void>> }
  const scopes: Array<{ dispose(): boolean }> = []
  let disposed = false
  let disposePromise: Promise<void> | undefined
  let current: string | undefined
  let sessionScope: ScopeState | undefined
  const cleanup = async (): Promise<Error | undefined> => {
    let firstError: Error | undefined
    const capture = (error: unknown) => {
      firstError ??= error instanceof Error ? error : new Error(String(error))
    }
    try { await ctx.get('mcp')?.close() } catch (error) { capture(error) }
    try { ctx.get('session')?.close() } catch (error) { capture(error) }
    for (const scope of [...scopes].reverse()) {
      try { scope.dispose() } catch (error) { capture(error) }
    }
    return firstError
  }
  const sessionInitializationError = (cause: unknown): Error => {
    const detail = cause instanceof Error ? cause.message : String(cause)
    const lockHint = /locked|busy|another runtime/i.test(detail) ? '; another runtime may already own it' : ''
    return new Error(`Failed to initialize session database at "${config.sessionDb}": ${detail}${lockHint}`, {
      cause: cause instanceof Error ? cause : undefined,
    })
  }
  const skillsPlugin = config.plugins.includes('skills') ? await createSkillsPlugin(config) : undefined
  const plugins = {
    logger: loggerPlugin,
    hooks: hooksPlugin,
    llm: createLlmPlugin(config, fetchImpl),
    tools: createToolsPlugin(config),
    mcp: createMcpPlugin(config),
    skills: skillsPlugin,
    permission: createPermissionPlugin(config, approvalHandler),
    session: createSessionPlugin(config),
    agent: createAgentPlugin(config),
  }
  try {
    const pluginOrder = ['logger', 'hooks', 'permission', 'llm', 'tools', 'mcp', 'skills', 'session', 'agent'] as const
    for (const name of pluginOrder.filter((candidate) => config.plugins.includes(candidate))) {
      current = name
      const plugin = name === 'skills' ? skillsPlugin! : plugins[name]
      const scope = ctx.plugin(plugin)
      const state = (scope as unknown as { runtime?: ScopeState }).runtime ?? (scope as unknown as ScopeState)
      scopes.push(scope)
      if (name === 'session') sessionScope = state
      await scope
      const scopeTasks = (scope as unknown as { tasks?: Set<Promise<void>> }).tasks ?? []
      await Promise.allSettled([...(state.tasks ?? []), ...scopeTasks])
    }
    if (config.plugins.includes('session') && !ctx.get('session')) {
      throw sessionInitializationError(sessionScope?.error ?? new Error('session plugin did not initialize'))
    }
    if (config.plugins.includes('mcp')) await ctx.get('mcp')?.start()
  } catch (error) {
    await cleanup()
    if (current === 'session' && !ctx.get('session') && !(error instanceof Error && error.message.startsWith('Failed to initialize session database'))) {
      throw sessionInitializationError(sessionScope?.error ?? error)
    }
    throw error
  }
  return {
    ctx,
    async dispose() {
      if (disposePromise) return disposePromise
      if (disposed) return
      disposed = true
      disposePromise = (async () => {
        const cleanupError = await cleanup()
        await ctx.stop()
        if (cleanupError) throw cleanupError
      })()
      return disposePromise
    },
  }
}
