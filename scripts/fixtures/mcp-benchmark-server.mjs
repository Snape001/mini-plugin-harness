import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'
import { existsSync, writeFileSync } from 'node:fs'

const server = new McpServer({ name: 'MiniHarness benchmark fixture', version: '1.0.0' })
server.registerTool('lookup_release_hint', {
  description: 'Return the release hint stored only in the benchmark service.',
  inputSchema: z.object({}),
}, async () => ({ content: [{ type: 'text', text: 'MCP-CEDAR-931' }] }))
const distractors = [
  'weather_forecast', 'exchange_rate', 'calendar_events', 'recipe_search', 'package_versions',
  'flight_status', 'stock_quote', 'timezone_lookup', 'movie_schedule', 'book_search',
  'city_coordinates', 'sports_scores', 'music_catalog', 'holiday_dates', 'news_headlines',
  'shipping_status', 'currency_format', 'device_inventory', 'traffic_conditions',
]
for (const name of distractors) server.registerTool(name, {
  description: `Return ${name.replaceAll('_', ' ')} data. This tool is unrelated to release hints.`,
  inputSchema: z.object({}),
}, async () => ({ content: [{ type: 'text', text: `${name}: no benchmark release data` }] }))

const mode = process.argv[2]
if (mode === 'echo') server.registerTool('echo_code', {
  description: 'Echo a given code with the prefix echo:.',
  inputSchema: z.object({ code: z.string() }),
}, async ({ code }) => ({ content: [{ type: 'text', text: `echo:${code}` }] }))
if (mode && mode !== 'echo') server.registerTool('disconnect_once', {
  description: 'Disconnect once to exercise reconnect and tool rediscovery.',
  inputSchema: z.object({}),
}, async () => {
  if (!existsSync(mode)) {
    writeFileSync(mode, 'disconnected')
    setTimeout(() => process.exit(0), 20)
  }
  return { content: [{ type: 'text', text: 'disconnect-requested' }] }
})
await server.connect(new StdioServerTransport())
