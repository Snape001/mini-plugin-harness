import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'

const server = new McpServer({ name: 'MiniHarness test server', version: '1.0.0' })
let added = false

server.registerTool('echo_text', {
  description: 'Return the supplied text.',
  inputSchema: z.object({ text: z.string() }),
}, async ({ text }) => ({
  content: [{ type: 'text', text: `echo:${text}` }],
  structuredContent: { echoed: text },
}))

server.registerTool('add_tool', {
  description: 'Add a tool to test list change notifications.',
  inputSchema: z.object({}),
}, async () => {
  if (!added) {
    added = true
    server.registerTool('late_tool', {
      description: 'A tool added after startup.',
      inputSchema: z.object({}),
    }, async () => ({ content: [{ type: 'text', text: 'late' }] }))
  }
  return { content: [{ type: 'text', text: 'added' }] }
})

server.registerTool('report_error', {
  description: 'Return an MCP tool error result.',
  inputSchema: z.object({}),
}, async () => ({ isError: true, content: [{ type: 'text', text: 'remote failure' }] }))

await server.connect(new StdioServerTransport())
