export type JsonSchema = Record<string, unknown>

export type ToolPermissionLevel = 'read' | 'write' | 'dangerous'

export interface ToolDefinition {
  name: string
  description: string
  parameters: JsonSchema
  permission: ToolPermissionLevel
}

export interface ToolResult {
  content: Array<Record<string, unknown>>
  isError: boolean
  structuredContent?: unknown
}

export interface ToolRegistration {
  definition: ToolDefinition
  validate(args: unknown): Record<string, unknown>
  execute(args: Record<string, unknown>, options?: ToolExecutionOptions): Promise<ToolResult> | ToolResult
}

export interface ToolExecutionOptions {
  taskId?: string
  attempt?: number
  signal?: AbortSignal
}

export interface SkillMetadata {
  name: string
  description: string
  tags: string[]
}

export interface SkillDocument extends SkillMetadata {
  content: string
}

export interface SkillSelectionUsage { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }
export interface SkillTrace {
  taskId: string
  status: 'selected' | 'failed' | 'skipped'
  selected: string[]
  failure: string | null
  selectionRequests: number
  selectionCacheHit?: boolean
  selectionDurationMs: number
  selectionUsage: SkillSelectionUsage
  loads: Array<{ name: string; status: 'loaded' | 'failed'; tokens: number; error?: string }>
  contextTokens: number
  injectedTurns: number
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
}

export interface ModelReply {
  message: ChatMessage
  toolCalls: ToolCall[]
  finishReason: string
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
}
export type PromptType = 'system' | 'task' | 'tool'
export type PromptStage = 'initial' | 'tool_followup' | 'resume'
export interface PromptTemplate { id: string; name: string; description: string; version: string; type: PromptType; scenarios: string[]; stages: PromptStage[]; priority: number; enabled: boolean; template: string; digest: string }
export interface PromptOptions { taskType?: string; versions?: Record<string, string> }
export interface PromptSnapshot { taskType: string; versions: Record<string, string>; templates: PromptTemplate[] }
export interface PromptTrace { taskId: string; iteration: number; stage: PromptStage; status: 'pending' | 'completed' | 'failed'; messages: ChatMessage[]; tools: ToolDefinition[]; templates: Array<{ id: string; digest: string }>; variables: Record<string, string>; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; error: string | null }
export interface PromptService {
  list(): PromptTemplate[]
  get(id: string): PromptTemplate | undefined
  setEnabled(id: string, enabled: boolean): void
  prepare(taskId: string, task: string, options?: PromptOptions, signal?: AbortSignal): Promise<PromptSnapshot>
  render(snapshot: PromptSnapshot, stage: PromptStage, task: string, toolNames: string[], signal?: AbortSignal): Promise<{ system: string; task: string; tool: string; templates: Array<{ id: string; digest: string }>; variables: Record<string, string> }>
  traces(taskId: string): PromptTrace[]
}

export type AgentEvent =
  | { type: 'skills.selecting'; candidates: number }
  | { type: 'skills.selected'; names: string[] }
  | { type: 'skills.failed'; reason: string }
  | { type: 'skills.loaded'; name: string }
  | { type: 'model.request'; iteration: number }
  | { type: 'tool.start'; name: string; arguments: unknown }
  | { type: 'tool.end'; name: string; result: unknown; error?: string }
  | { type: 'agent.paused'; taskId: string; iteration: number; maxTaskIterations: number }
  | { type: 'agent.final'; answer: string }

export interface HookService {
  beforeTool(call: ToolCall, args: unknown): Promise<unknown | false>
  afterTool(call: ToolCall, args: unknown, result: unknown, error?: Error): Promise<void>
}

export interface ApprovalRequest {
  callId: string
  toolName: string
  permission: 'dangerous'
  args: Readonly<Record<string, unknown>>
}

export type ApprovalHandler = (request: ApprovalRequest, signal: AbortSignal) => Promise<boolean>

export interface PermissionService {
  authorize(definition: ToolDefinition, args: Record<string, unknown>, callId: string, signal?: AbortSignal): Promise<void>
}

export interface ToolService {
  definitions(): ToolDefinition[]
  setToolsEnabled(names: string[], enabled: boolean): void
  execute(name: string, args: unknown, callId?: string, options?: ToolExecutionOptions): Promise<ToolResult>
  replaceSource(sourceId: string, registrations: ToolRegistration[]): { registered: string[]; conflicts: string[] }
  removeSource(sourceId: string): void
}

export interface McpService {
  start(): Promise<void>
  close(): Promise<void>
}

export interface LlmService {
  complete(messages: ChatMessage[], tools: ToolDefinition[], signal?: AbortSignal): Promise<ModelReply>
  selectSkills(task: string, candidates: SkillMetadata[], maxSkills: number, signal?: AbortSignal, onUsage?: (usage: SkillSelectionUsage) => void): Promise<string[]>
  summarize(messages: ChatMessage[], signal?: AbortSignal, maxOutputTokens?: number): Promise<string>
}

export interface SkillService {
  list(): SkillMetadata[]
  load(name: string): Promise<SkillDocument>
}

export interface AgentService {
  run(task: string, sessionIdOrEvent?: string | ((event: AgentEvent) => void), onEvent?: (event: AgentEvent) => void, signal?: AbortSignal, promptOptions?: PromptOptions): Promise<string>
  resume(taskId: string, onEvent?: (event: AgentEvent) => void, signal?: AbortSignal): Promise<string>
}

export interface AgentCapabilities {
  skills: boolean
  sessionContext: boolean
  contextEnhancements: boolean
  recovery: boolean
}

export type TaskStatus = 'running' | 'paused' | 'interrupted' | 'completed' | 'failed'
export type ToolCallStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'unknown'
export type ToolAttemptStatus = 'running' | 'succeeded' | 'failed' | 'unknown'
export interface SessionRecord { id: string; createdAt: string }
export interface TaskRecord { id: string; sessionId: string; prompt: string; status: TaskStatus; iteration: number; skills: string[]; skillsSelected: boolean; createdAt: string; error: string | null }
export interface StoredMessage { id: number; taskId: string; message: ChatMessage }
export interface StoredCall { id: string; taskId: string; status: ToolCallStatus; name: string; arguments: string; result: string | null }
export interface ToolAttemptRecord { callId: string; attempt: number; status: ToolAttemptStatus; startedAt: string; finishedAt: string | null; durationMs: number | null; errorCode: string | null; error: string | null; approval: string | null }
export interface SummaryCheckpoint { sessionId: string; fromMessageId: number; throughMessageId: number; content: string }
export type ContextLevel = 'L1' | 'L2' | 'L3'
export interface ContextCheckpoint { id: number; sessionId: string; taskId?: string; level: ContextLevel; fromMessageId: number; throughMessageId: number; content: string }
export interface SessionService {
  createSession(): SessionRecord
  getSession(id: string): SessionRecord
  listSessions(): SessionRecord[]
  listTasks(sessionId: string): TaskRecord[]
  getTask(id: string): TaskRecord
  startTask(sessionId: string, prompt: string): TaskRecord
  setTaskSkills(id: string, skills: string[]): void
  saveSkillTrace(trace: SkillTrace): void
  getSkillTrace(taskId: string): SkillTrace | undefined
  setTaskStatus(id: string, status: TaskStatus, error?: string): void
  appendMessage(taskId: string, message: ChatMessage): number
  recordAssistant(taskId: string, message: ChatMessage, calls: ToolCall[], iteration: number): void
  listMessages(sessionId: string): StoredMessage[]
  listMessagesSince(sessionId: string, afterMessageId: number, taskId?: string): StoredMessage[]
  getLastMessage(taskId: string): StoredMessage | undefined
  startCall(id: string): void
  finishCall(id: string, status: 'succeeded' | 'failed' | 'unknown', content: string): void
  startAttempt(callId: string, attempt: number): void
  finishAttempt(callId: string, attempt: number, status: ToolAttemptStatus, details?: { errorCode?: string; error?: string; approval?: string }): void
  listAttempts(callId: string): ToolAttemptRecord[]
  listCalls(taskId: string): StoredCall[]
  reconcileCalls(taskId: string): void
  getSummary(sessionId: string, taskId?: string): SummaryCheckpoint | undefined
  saveSummary(sessionId: string, fromMessageId: number, throughMessageId: number, content: string, taskId?: string): void
  listContextCheckpoints(sessionId: string, taskId?: string): ContextCheckpoint[]
  replaceContextCheckpoints(sessionId: string, removedIds: number[], checkpoint: Omit<ContextCheckpoint, 'id'>, taskId?: string): void
  listMessagesRange(sessionId: string, fromMessageId: number, throughMessageId: number, taskId?: string): StoredMessage[]
  getPromptSnapshot(taskId: string): PromptSnapshot | undefined
  savePromptSnapshot(taskId: string, snapshot: PromptSnapshot): void
  startPromptTrace(trace: PromptTrace): void
  finishPromptTrace(taskId: string, iteration: number, status: 'completed' | 'failed', usage?: ModelReply['usage'], error?: string): void
  listPromptTraces(taskId: string): PromptTrace[]
  close(): void
}
