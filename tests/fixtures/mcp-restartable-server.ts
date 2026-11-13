import { readFile } from 'node:fs/promises'
import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'

try {
  await readFile(process.argv[2]!)
} catch {
  process.exit(1)
}

const server = new McpServer({ name: 'MiniHarness restartable test server', version: '1.0.0' })
server.registerTool('reconnected', {
  description: 'Available after reconnect.',
  inputSchema: z.object({}),
}, async () => ({ content: [{ type: 'text', text: 'reconnected' }] }))
await server.connect(new StdioServerTransport())
