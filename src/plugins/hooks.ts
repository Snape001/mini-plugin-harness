import type { Context } from 'cordis'
import '../services.js'
import type { ToolCall } from '../types.js'

export const hooksPlugin = {
  name: 'hooks',
  apply(ctx: Context) {
    ctx.set('hooks', {
    async beforeTool(call, args) {
      return await ctx.bail('tool/before', call, args) ?? args
    },
    async afterTool(call, args, result, error) {
      await ctx.serial('tool/after', call, args, result, error)
    },
    })
    ctx.on('tool/before', (call) => {
      process.stdout.write(`[hook] before tool: ${call.name}\n`)
    })
    ctx.on('tool/after', (call, _args, _result, error) => {
      process.stdout.write(`[hook] after tool: ${call.name}${error ? ' (error)' : ''}\n`)
    })
  },
}
