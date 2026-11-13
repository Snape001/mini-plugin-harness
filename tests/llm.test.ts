import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'

describe('LLM summary token limits', () => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY
  let root: string | undefined

  afterEach(async () => {
    if (previousApiKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = previousApiKey
    if (root) await rm(root, { recursive: true, force: true })
    root = undefined
  })

  it('passes each shorter Context retry budget to the model output limit', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-llm-key'
    root = await mkdtemp(path.join(os.tmpdir(), 'miniharness-llm-'))
    let requestBody: Record<string, unknown> | undefined
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'compact summary' } }],
        usage: { prompt_tokens: 30, completion_tokens: 4, total_tokens: 34 },
      }), { status: 200 })
    }) as typeof fetch
    const config = configSchema.parse({ projectRoot: root, sessionDb: path.join(root, 'sessions.sqlite'), plugins: ['llm'], contextInputTokens: 4096, contextOutputReserve: 512 })
    const runtime = await createRuntime(config, fetchImpl)
    try {
      await runtime.ctx.llm.summarize([{ role: 'user', content: 'summarize this history' }], undefined, 64)
      expect(requestBody?.max_tokens).toBe(64)
    } finally {
      await runtime.dispose()
    }
  })
})
