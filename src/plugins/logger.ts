import pino from 'pino'
import type { Context } from 'cordis'

export const loggerPlugin = {
  name: 'logger',
  apply(ctx: Context) {
    const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })
    ctx.on('internal/runtime', (runtime) => logger.info({ plugin: runtime.plugin.name }, 'plugin runtime created'))
    ctx.on('internal/status', (scope, oldStatus) => logger.debug({ status: scope.status, oldStatus }, 'plugin status changed'))
    ctx.on('agent/event', (event) => {
      const safeEvent = event.type === 'tool.end'
        ? { ...event, result: summarize(event.result) }
        : event.type === 'tool.start'
          ? { ...event, arguments: summarize(event.arguments) }
          : event
      logger.info({ event: safeEvent }, 'agent event')
    })
    ctx.on('skills/invalid', (entry, reason) => logger.warn({ entry, reason }, 'invalid Skill skipped'))
    ctx.on('mcp/server/status', (event) => {
      const log = event.status === 'connected' ? logger.info.bind(logger) : logger.warn.bind(logger)
      log({ server: event.id, status: event.status, ...(event.error ? { error: event.error } : {}) }, 'MCP server status')
    })
    ctx.on('mcp/server/warning', (event) => logger.warn({ server: event.id, message: event.message }, 'MCP server warning'))
  },
}

function summarize(value: unknown): unknown {
  if (typeof value === 'string') return { type: 'text', characters: value.length }
  if (Array.isArray(value)) return { type: 'list', items: value.length }
  if (value && typeof value === 'object') return { type: 'object', keys: Object.keys(value).slice(0, 20) }
  return value
}
