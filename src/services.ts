import type { Context, Events } from 'cordis'
import type { AgentEvent, AgentService, HookService, LlmService, McpService, PermissionService, SessionService, SkillService, ToolCall, ToolService } from './types.js'

declare module 'cordis' {
  interface Context {
    llm: LlmService
    tools: ToolService
    mcp: McpService
    hooks: HookService
    permission: PermissionService
    skills: SkillService
    agent: AgentService
    session: SessionService
  }
  interface Events {
    'agent/event': (event: AgentEvent) => void
    'skills/invalid': (entry: string, reason: string) => void
    'tool/before': (call: ToolCall, args: unknown) => unknown | false
    'tool/after': (call: ToolCall, args: unknown, result: unknown, error?: Error) => void
    'mcp/server/status': (event: { id: string; status: 'connected' | 'reconnecting' | 'offline'; error?: string }) => void
    'mcp/server/warning': (event: { id: string; message: string }) => void
  }
}
