import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig, configSchema } from '../src/config.js'

const dirs: string[] = []
async function configFile(contents: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'miniharness-config-'))
  dirs.push(dir)
  const file = path.join(dir, 'runtime.yml')
  await writeFile(file, contents)
  return file
}

afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

describe('loadConfig', () => {
  it('loads defaults and resolves projectRoot relative to the YAML file', async () => {
    const file = await configFile('plugins: [logger]\nprojectRoot: .\n')
    const config = await loadConfig(file)
    expect(config.plugins).toEqual(['logger'])
    expect(config.projectRoot).toBe(path.dirname(file))
    expect(config.skillsDir).toBe(path.join(path.dirname(file), 'skills'))
    expect(config.permissions).toMatchObject({ allow: [], deny: [], defaultWrite: 'deny', approvalTimeoutMs: 30_000 })
  })

  it('rejects unknown plugin names and invalid limits', async () => {
    await expect(loadConfig(await configFile('plugins: [remote]\n'))).rejects.toThrow(/plugins/)
    await expect(loadConfig(await configFile('maxIterations: 0\n'))).rejects.toThrow(/maxIterations/)
    await expect(loadConfig(await configFile('permissions:\n  approvalTimeoutMs: 0\n'))).rejects.toThrow(/approvalTimeoutMs/)
  })

  it('rejects duplicate plugins, non-HTTP API URLs, and defaults MCP connect timeouts', () => {
    expect(() => configSchema.parse({ plugins: ['logger', 'logger'] })).toThrow(/duplicate plugin/)
    expect(() => configSchema.parse({ apiBaseUrl: 'ftp://example.com' })).toThrow(/HTTP or HTTPS/)
    const config = configSchema.parse({})
    expect(config.mcp.connectTimeoutMs).toBe(15_000)
    expect(config.requestTimeoutMs).toBe(120_000)
  })
})
