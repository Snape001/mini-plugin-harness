import { Ajv2020, type AnySchema } from 'ajv/dist/2020.js'
import { Client, StreamableHTTPClientTransport, type Tool } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import type { Context } from 'cordis'
import { createHash } from 'node:crypto'
import type { RuntimeConfig } from '../config.js'
import '../services.js'
import type { McpService, ToolRegistration, ToolResult } from '../types.js'

type McpServerConfig = RuntimeConfig['mcp']['servers'][number]
type Connection = {
  config: McpServerConfig
  sourceId: string
  client?: Client
  transport?: StdioClientTransport | StreamableHTTPClientTransport
  generation: number
  retryCount: number
  retryTimer?: ReturnType<typeof setTimeout>
  connecting: boolean
}

const retryDelays = [1_000, 2_000, 4_000]
const ajv = new Ajv2020({ allErrors: true, strict: false })

function safeToolName(serverId: string, toolName: string): string {
  const slug = (value: string, max: number) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max) || 'tool'
  const hash = createHash('sha256').update(serverId).update('\0').update(toolName).digest('hex').slice(0, 8)
  return `mcp_${slug(serverId, 12)}_${slug(toolName, 30)}_${hash}`
}

function remoteRegistrations(server: McpServerConfig, client: Client, remoteTools: Tool[], onInvalid: (message: string) => void): ToolRegistration[] {
  const registrations: ToolRegistration[] = []
  for (const tool of remoteTools) {
    let validateSchema: ReturnType<typeof ajv.compile> | undefined
    try {
      if (!tool.inputSchema || typeof tool.inputSchema !== 'object' || Array.isArray(tool.inputSchema)) {
        throw new Error('inputSchema must be a JSON Schema object')
      }
      validateSchema = ajv.compile(tool.inputSchema as AnySchema)
    } catch (error) {
      onInvalid(`MCP server "${server.id}" tool "${tool.name}" has an unsupported input schema: ${(error as Error).message}`)
      continue
    }
    const compiledSchema = validateSchema
    const permission = server.toolPermissions[tool.name] ?? server.permission ?? 'dangerous'
    registrations.push({
      definition: {
        name: safeToolName(server.id, tool.name),
        description: tool.description ?? `MCP tool ${tool.name} from server ${server.id}`,
        parameters: structuredClone(tool.inputSchema) as Record<string, unknown>,
        permission,
      },
      validate(args) {
        if (!args || typeof args !== 'object' || Array.isArray(args) || !compiledSchema(args)) {
          const details = ajv.errorsText(compiledSchema.errors, { separator: '; ' })
          throw new Error(`Invalid arguments for MCP tool "${tool.name}"${details ? `: ${details}` : ''}`)
        }
        return args as Record<string, unknown>
      },
      async execute(args, options): Promise<ToolResult> {
        const result = await client.callTool({ name: tool.name, arguments: args }, options?.signal ? { signal: options.signal } : undefined)
        return {
          content: result.content as unknown as Array<Record<string, unknown>>,
          isError: Boolean(result.isError),
          ...(result.structuredContent === undefined ? {} : { structuredContent: result.structuredContent }),
        }
      },
    })
  }
  return registrations
}

export function createMcpPlugin(config: RuntimeConfig) {
  return {
    name: 'mcp',
    inject: ['tools'],
    apply(ctx: Context) {
      let closed = false
      let started = false
      const connectTimeoutMs = config.mcp.connectTimeoutMs
      const reconnectProbeMs = config.mcp.reconnectProbeMs
      const connections = new Map<string, Connection>()
      const emitStatus = (id: string, status: 'connected' | 'reconnecting' | 'offline', error?: string) => {
        ctx.emit('mcp/server/status', { id, status, ...(error ? { error } : {}) })
      }
      const emitWarning = (id: string, message: string) => ctx.emit('mcp/server/warning', { id, message })

      const scheduleReconnect = (connection: Connection, reason: string) => {
        if (closed || connection.retryTimer) return
        const delay = connection.retryCount < retryDelays.length
          ? retryDelays[connection.retryCount++]
          : reconnectProbeMs * (0.8 + Math.random() * 0.4)
        emitStatus(connection.config.id, 'reconnecting', reason)
        connection.retryTimer = setTimeout(() => {
          connection.retryTimer = undefined
          void connect(connection)
        }, delay)
        connection.retryTimer.unref?.()
      }

      const unregister = (connection: Connection) => ctx.tools.removeSource(connection.sourceId)

      const installTools = (connection: Connection, client: Client, generation: number, remoteTools: Tool[]) => {
        if (closed || connection.generation !== generation || connection.client !== client) return
        let registrations: ToolRegistration[]
        try {
          registrations = remoteRegistrations(connection.config, client, remoteTools, (message) => {
            emitWarning(connection.config.id, message)
          })
        } catch (error) {
          emitWarning(connection.config.id, (error as Error).message)
          return
        }
        const update = ctx.tools.replaceSource(connection.sourceId, registrations)
        for (const name of update.conflicts) {
          emitWarning(connection.config.id, `MCP tool name conflict: ${name}`)
        }
      }

      const disconnect = (connection: Connection, client: Client, generation: number, error?: Error) => {
        if (closed || connection.generation !== generation || connection.client !== client) return
        connection.client = undefined
        connection.transport = undefined
        unregister(connection)
        void client.close().catch(() => {})
        scheduleReconnect(connection, error?.message ?? 'MCP connection closed')
      }

      const connect = async (connection: Connection): Promise<void> => {
        if (closed || connection.connecting) return
        if (connection.config.transport === 'http' && connection.config.bearerTokenEnv && !process.env[connection.config.bearerTokenEnv]) {
          unregister(connection)
          emitStatus(connection.config.id, 'offline', `Environment variable ${connection.config.bearerTokenEnv} is not set`)
          scheduleReconnect(connection, `Environment variable ${connection.config.bearerTokenEnv} is not set`)
          return
        }

        connection.connecting = true
        const generation = ++connection.generation
        let transport: StdioClientTransport | StreamableHTTPClientTransport
        let client: Client
        try {
          if (connection.config.transport === 'stdio') {
            transport = new StdioClientTransport({
              command: connection.config.command,
              args: connection.config.args,
              ...(connection.config.cwd ? { cwd: connection.config.cwd } : {}),
            })
          } else {
            const headers: Record<string, string> = {}
            if (connection.config.bearerTokenEnv) {
              headers.Authorization = `Bearer ${process.env[connection.config.bearerTokenEnv]}`
            }
            transport = new StreamableHTTPClientTransport(new URL(connection.config.url), {
              ...(Object.keys(headers).length ? { requestInit: { headers } } : {}),
            })
          }
          client = new Client(
            { name: 'miniharness', version: '0.1.0' },
            {
              listChanged: {
                tools: {
                  onChanged(error, remoteTools) {
                    if (error) {
                      emitWarning(connection.config.id, `Tool list refresh failed: ${error.message}`)
                      return
                    }
                    if (remoteTools) installTools(connection, client, generation, remoteTools)
                  },
                },
              },
            },
          )
        } catch (error) {
          connection.connecting = false
          unregister(connection)
          scheduleReconnect(connection, (error as Error).message)
          return
        }
        connection.client = client
        connection.transport = transport
        transport.onerror = (error) => disconnect(connection, client, generation, error)
        transport.onclose = () => disconnect(connection, client, generation)

        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error(`MCP server "${connection.config.id}" did not connect within ${connectTimeoutMs} ms`))
            }, connectTimeoutMs)
            timer.unref?.()
          })
          const tools = await Promise.race([
            client.connect(transport).then(() => client.listTools()).then((result) => result.tools),
            timeout,
          ])
          if (closed || connection.generation !== generation || connection.client !== client) {
            await client.close().catch(() => {})
            return
          }
          connection.retryCount = 0
          installTools(connection, client, generation, tools)
          emitStatus(connection.config.id, 'connected')
        } catch (error) {
          if (connection.generation === generation && connection.client === client) {
            connection.client = undefined
            connection.transport = undefined
            unregister(connection)
            // Invalidate a late connect/listTools completion so it cannot install tools.
            connection.generation++
            await client.close().catch(() => {})
            scheduleReconnect(connection, (error as Error).message)
          }
        } finally {
          if (timer) clearTimeout(timer)
          connection.connecting = false
        }
      }

      const service: McpService = {
        async start() {
          if (started || closed) return
          started = true
          await Promise.all([...connections.values()].map((connection) => connect(connection)))
        },
        async close() {
          if (closed) return
          closed = true
          const closing: Promise<unknown>[] = []
          for (const connection of connections.values()) {
            if (connection.retryTimer) clearTimeout(connection.retryTimer)
            connection.retryTimer = undefined
            unregister(connection)
            if (connection.client) closing.push(connection.client.close().catch(() => {}))
            else if (connection.transport) closing.push(connection.transport.close().catch(() => {}))
            connection.client = undefined
            connection.transport = undefined
          }
          await Promise.all(closing)
        },
      }
      ctx.set('mcp', service)

      for (const server of config.mcp.servers) {
        const connection: Connection = {
          config: server,
          sourceId: `mcp:${server.id}`,
          generation: 0,
          retryCount: 0,
          connecting: false,
        }
        connections.set(server.id, connection)
      }
    },
  }
}
