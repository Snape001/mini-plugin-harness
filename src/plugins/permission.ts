import type { Context } from 'cordis'
import type { ApprovalHandler, PermissionService, ToolDefinition } from '../types.js'
import type { RuntimeConfig } from '../config.js'
import '../services.js'

export class PermissionDeniedError extends Error {
  readonly code: string = 'PERMISSION_DENIED'
  constructor(message: string) { super(message); this.name = 'PermissionDeniedError' }
}

export class ApprovalRejectedError extends PermissionDeniedError {
  readonly code = 'APPROVAL_REJECTED'
  constructor(message = 'User rejected the dangerous tool call') { super(message); this.name = 'ApprovalRejectedError' }
}

export class ApprovalUnavailableError extends PermissionDeniedError {
  readonly code = 'APPROVAL_UNAVAILABLE'
  constructor() { super('No interactive approval handler is available'); this.name = 'ApprovalUnavailableError' }
}

export class ApprovalTimeoutError extends PermissionDeniedError {
  readonly code = 'APPROVAL_TIMEOUT'
  constructor(timeoutMs: number) { super(`Approval timed out after ${timeoutMs} ms`); this.name = 'ApprovalTimeoutError' }
}

export class ToolExecutionError extends Error {
  readonly code = 'TOOL_EXECUTION_FAILED'
  constructor(message: string, readonly permission: ToolDefinition['permission'], options?: ErrorOptions) {
    super(message, options)
    this.name = 'ToolExecutionError'
  }
  get retryable() { return this.permission === 'read' }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export function createPermissionPlugin(config: RuntimeConfig, approvalHandler?: ApprovalHandler) {
  return {
    name: 'permission',
    apply(ctx: Context) {
      const allow = new Set(config.permissions.allow)
      const deny = new Set(config.permissions.deny)
      const service: PermissionService = {
        async authorize(definition, args, callId, signal) {
          if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
          if (!definition?.name || !['read', 'write', 'dangerous'].includes(definition.permission)) {
            throw new PermissionDeniedError('Tool has no trusted permission registration')
          }
          if (deny.has(definition.name)) throw new PermissionDeniedError(`Tool "${definition.name}" is blocked by the deny list`)
          if (definition.permission === 'dangerous') {
            if (!approvalHandler) throw new ApprovalUnavailableError()
            const controller = new AbortController()
            const callerAborted = () => controller.abort(signal?.reason)
            signal?.addEventListener('abort', callerAborted, { once: true })
            let rejectForAbort: (() => void) | undefined
            let timedOut = false
            let timer: ReturnType<typeof setTimeout> | undefined
            try {
              const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                  timedOut = true
                  controller.abort()
                  reject(new ApprovalTimeoutError(config.permissions.approvalTimeoutMs))
                }, config.permissions.approvalTimeoutMs)
              })
              const request = deepFreeze({ callId, toolName: definition.name, permission: 'dangerous' as const, args: structuredClone(args) })
              const aborted = signal ? new Promise<never>((_, reject) => {
                rejectForAbort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
                if (signal.aborted) rejectForAbort()
                else signal.addEventListener('abort', rejectForAbort, { once: true })
              }) : new Promise<never>(() => {})
              const approved = await Promise.race([approvalHandler(request, controller.signal), timeout, aborted])
              if (!approved) throw new ApprovalRejectedError()
            } catch (error) {
              if (timedOut && !(error instanceof ApprovalTimeoutError)) throw new ApprovalTimeoutError(config.permissions.approvalTimeoutMs)
              throw error
            } finally {
              if (timer) clearTimeout(timer)
              signal?.removeEventListener('abort', callerAborted)
              if (rejectForAbort) signal?.removeEventListener('abort', rejectForAbort)
            }
            return
          }
          if (allow.has(definition.name)) return
          if (definition.permission === 'read') return
          if (config.permissions.defaultWrite === 'allow') return
          throw new PermissionDeniedError(`Tool "${definition.name}" is not allowed by the write policy`)
        },
      }
      ctx.set('permission', service)
    },
  }
}
