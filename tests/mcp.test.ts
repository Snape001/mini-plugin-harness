import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'
import type { ToolRegistration } from '../src/types.js'
import { z } from 'zod'

const dirs: string[] = []
const httpServers: Array<{ http: Server; mcp: McpServer }> = []

async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'miniharness-mcp-'))
  dirs.push(dir)
  return dir
}

function configFor(root: string, servers: unknown[], extra: Record<string, unknown> = {}) {
  return configSchema.parse({
    projectRoot: root,
    skillsDir: path.join(root, 'skills'),
    sessionDb: path.join(root, '.miniharness', 'sessions.sqlite'),
    plugins: ['logger', 'hooks', 'permission', 'llm', 'tools', 'mcp', 'skills', 'session', 'agent'],
    mcp: { servers },
    ...extra,
  })
}

async function startHttpServer(requireToken = false) {
  const mcp = new McpServer({ name: 'MiniHarness HTTP test server', version: '1.0.0' })
  mcp.registerTool('echo_text', {
    description: 'Return the supplied text.',
    inputSchema: z.object({ text: z.string() }),
  }, async ({ text }) => ({
    content: [{ type: 'text', text: `http:${text}` }],
    structuredContent: { echoed: text },
  }))
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  })
  await mcp.connect(transport)
  const http = createServer(async (incoming, outgoing) => {
    try {
      if (requireToken && incoming.headers.authorization !== 'Bearer test-mcp-token') {
        outgoing.writeHead(401)
        outgoing.end('unauthorized')
        return
      }
      const chunks: Buffer[] = []
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk))
      const body = Buffer.concat(chunks)
      const request = new Request(`http://127.0.0.1:${(http.address() as { port: number }).port}${incoming.url}`, {
        method: incoming.method,
        headers: incoming.headers as HeadersInit,
        ...(body.length ? { body, duplex: 'half' } as RequestInit : {}),
      })
      const response = await transport.handleRequest(request)
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()))
      outgoing.end(Buffer.from(await response.arrayBuffer()))
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500)
      outgoing.end('test MCP server error')
    }
  })
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve))
  httpServers.push({ http, mcp })
  const port = (http.address() as { port: number }).port
  return { url: `http://127.0.0.1:${port}/mcp` }
}

afterEach(async () => {
  delete process.env.MCP_TEST_TOKEN
  await Promise.all(httpServers.splice(0).map(async ({ http, mcp }) => {
    await new Promise<void>((resolve) => http.close(() => resolve()))
    await mcp.close()
  }))
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('MCP plugin', () => {
  it('connects over stdio, validates JSON Schema, normalizes results, and refreshes changed tools', async () => {
    const root = await tempDir()
    const fixture = path.resolve('tests/fixtures/mcp-stdio-server.ts')
    const runtime = await createRuntime(configFor(root, [{
      id: 'local_docs',
      transport: 'stdio',
      command: process.execPath,
      args: ['--import', 'tsx', fixture],
      permission: 'read',
    }]), fetch)
    try {
      const initial = runtime.ctx.tools.definitions()
      const echo = initial.find((definition) => definition.description === 'Return the supplied text.')
      const add = initial.find((definition) => definition.description === 'Add a tool to test list change notifications.')
      const reportError = initial.find((definition) => definition.description === 'Return an MCP tool error result.')
      expect(echo?.name).toMatch(/^mcp_local_docs_echo_text_[a-f0-9]{8}$/)
      expect(echo?.permission).toBe('read')
      expect(await runtime.ctx.tools.execute(echo!.name, { text: 'hello' })).toMatchObject({
        isError: false,
        content: [{ type: 'text', text: 'echo:hello' }],
        structuredContent: { echoed: 'hello' },
      })
      await expect(runtime.ctx.tools.execute(echo!.name, {})).rejects.toThrow(/Invalid arguments/)
      expect((await runtime.ctx.tools.execute(reportError!.name, {})).isError).toBe(true)

      await runtime.ctx.tools.execute(add!.name, {})
      await vi.waitFor(() => {
        expect(runtime.ctx.tools.definitions().some((definition) => definition.description === 'A tool added after startup.')).toBe(true)
      })

      const collision: ToolRegistration = {
        definition: { name: echo!.name, description: 'collision', parameters: { type: 'object' }, permission: 'read' },
        validate: () => ({}),
        execute: () => ({ isError: false, content: [] }),
      }
      expect(runtime.ctx.tools.replaceSource('collision', [collision]).conflicts).toEqual([echo!.name])
      expect(runtime.ctx.tools.definitions().find((definition) => definition.name === echo!.name)?.description).toBe(echo!.description)
    } finally {
      await runtime.dispose()
    }
  })

  it('connects to Streamable HTTP and sends a configured environment Bearer token', async () => {
    const root = await tempDir()
    const { url } = await startHttpServer(true)
    process.env.MCP_TEST_TOKEN = 'test-mcp-token'
    const runtime = await createRuntime(configFor(root, [{
      id: 'remote_search',
      transport: 'http',
      url,
      bearerTokenEnv: 'MCP_TEST_TOKEN',
      toolPermissions: { echo_text: 'read' },
    }]), fetch)
    try {
      const echo = runtime.ctx.tools.definitions().find((definition) => definition.description === 'Return the supplied text.')
      expect(echo).toBeDefined()
      expect(await runtime.ctx.tools.execute(echo!.name, { text: 'ready' })).toMatchObject({
        content: [{ type: 'text', text: 'http:ready' }],
        structuredContent: { echoed: 'ready' },
      })
    } finally {
      await runtime.dispose()
    }
  })

  it('isolates unavailable servers and rejects duplicate IDs or missing token variables', async () => {
    const root = await tempDir()
    expect(() => configFor(root, [
      { id: 'same', transport: 'stdio', command: 'node' },
      { id: 'same', transport: 'stdio', command: 'node' },
    ])).toThrow(/duplicate MCP server id/)

    const runtime = await createRuntime(configFor(root, [
      { id: 'missing_token', transport: 'http', url: 'http://127.0.0.1:1/mcp', bearerTokenEnv: 'MCP_TEST_TOKEN' },
      { id: 'unavailable', transport: 'stdio', command: path.join(root, 'missing-command') },
    ]), fetch)
    try {
      expect(runtime.ctx.tools.definitions().some((definition) => definition.name === 'read_file')).toBe(true)
      expect(runtime.ctx.tools.definitions().some((definition) => definition.name.startsWith('mcp_'))).toBe(false)
      expect(runtime.ctx.get('mcp')).toBeDefined()
    } finally {
      await runtime.dispose()
    }
  })

  it('reconnects with backoff and rediscovers tools after a server returns', async () => {
    const root = await tempDir()
    const marker = path.join(root, 'start-server')
    const fixture = path.resolve('tests/fixtures/mcp-restartable-server.ts')
    const runtime = await createRuntime(configFor(root, [{
      id: 'restartable',
      transport: 'stdio',
      command: process.execPath,
      args: ['--import', 'tsx', fixture, marker],
      permission: 'read',
    }]), fetch)
    try {
      expect(runtime.ctx.tools.definitions().some((definition) => definition.description === 'Available after reconnect.')).toBe(false)
      await writeFile(marker, 'start')
      await vi.waitFor(() => {
        expect(runtime.ctx.tools.definitions().some((definition) => definition.description === 'Available after reconnect.')).toBe(true)
      }, { timeout: 6_000, interval: 100 })
    } finally {
      await runtime.dispose()
    }
  })

  it('keeps probing after the initial backoff is exhausted', async () => {
    const root = await tempDir()
    const marker = path.join(root, 'start-server')
    const fixture = path.resolve('tests/fixtures/mcp-restartable-server.ts')
    const server = {
      id: 'long_offline',
      transport: 'stdio',
      command: process.execPath,
      args: ['--import', 'tsx', fixture, marker],
      permission: 'read',
    }
    const runtime = await createRuntime(configFor(root, [server], {
      mcp: { servers: [server], connectTimeoutMs: 500, reconnectProbeMs: 20 },
    }), fetch)
    try {
      await new Promise((resolve) => setTimeout(resolve, 7_200))
      await writeFile(marker, 'start')
      await vi.waitFor(() => {
        expect(runtime.ctx.tools.definitions().some((definition) => definition.description === 'Available after reconnect.')).toBe(true)
      }, { timeout: 3_000, interval: 20 })
    } finally { await runtime.dispose() }
  }, 15_000)

  it('retries a server whose token becomes available after startup', async () => {
    const root = await tempDir()
    const { url } = await startHttpServer(true)
    delete process.env.MCP_TEST_TOKEN
    const runtime = await createRuntime(configFor(root, [{
      id: 'late_token',
      transport: 'http',
      url,
      bearerTokenEnv: 'MCP_TEST_TOKEN',
      permission: 'read',
    }]), fetch)
    try {
      process.env.MCP_TEST_TOKEN = 'test-mcp-token'
      await vi.waitFor(() => {
        expect(runtime.ctx.tools.definitions().some((definition) => definition.description === 'Return the supplied text.')).toBe(true)
      }, { timeout: 3_000, interval: 50 })
    } finally { await runtime.dispose() }
  })

  it('times out a server that never completes initialization', async () => {
    const root = await tempDir()
    const fixture = path.resolve('tests/fixtures/mcp-hanging-server.ts')
    const server = {
      id: 'hanging',
      transport: 'stdio',
      command: process.execPath,
      args: ['--import', 'tsx', fixture],
      permission: 'read',
    }
    const started = Date.now()
    const runtime = await createRuntime(configFor(root, [server], {
      mcp: { servers: [server], connectTimeoutMs: 200 },
    }), fetch)
    try {
      expect(Date.now() - started).toBeLessThan(5_000)
      expect(runtime.ctx.tools.definitions().some((definition) => definition.name.startsWith('mcp_'))).toBe(false)
    } finally {
      await runtime.dispose()
    }
  })

  it('requires approval by default and applies per-tool permissions over the server permission', async () => {
    const root = await tempDir()
    const fixture = path.resolve('tests/fixtures/mcp-stdio-server.ts')
    const approval = vi.fn(async () => true)
    const runtime = await createRuntime(configFor(root, [{
      id: 'policy',
      transport: 'stdio',
      command: process.execPath,
      args: ['--import', 'tsx', fixture],
      permission: 'read',
      toolPermissions: { report_error: 'dangerous' },
    }]), fetch, approval)
    try {
      const dangerous = runtime.ctx.tools.definitions().find((definition) => definition.description === 'Return an MCP tool error result.')
      expect(dangerous?.permission).toBe('dangerous')
      await runtime.ctx.tools.execute(dangerous!.name, {})
      expect(approval).toHaveBeenCalledOnce()
    } finally {
      await runtime.dispose()
    }
  })
})
