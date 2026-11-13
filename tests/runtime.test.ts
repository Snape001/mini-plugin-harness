import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'

const dirs: string[] = []
async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'miniharness-runtime-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

describe('runtime lifecycle', () => {
  it('disposes twice without throwing', async () => {
    const root = await tempDir()
    const runtime = await createRuntime(configSchema.parse({
      projectRoot: root,
      sessionDb: path.join(root, '.miniharness', 'sessions.sqlite'),
      plugins: ['session'],
    }))
    await Promise.all([runtime.dispose(), runtime.dispose()])
    await expect(runtime.dispose()).resolves.toBeUndefined()
  })

  it('distinguishes a database path error from a lock conflict', async () => {
    const root = await tempDir()
    const sessionDb = path.join(root, '.miniharness', 'sessions.sqlite')
    await mkdir(sessionDb, { recursive: true })
    const error = await createRuntime(configSchema.parse({
      projectRoot: root,
      sessionDb,
      plugins: ['session'],
    })).catch((cause: unknown) => cause as Error)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('unable to open database file')
    expect((error as Error).message).not.toContain('another runtime')
  })
})
