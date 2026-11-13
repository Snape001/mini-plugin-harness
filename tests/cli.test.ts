import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
async function tempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'miniharness-cli-'))
  roots.push(root)
  await mkdir(path.join(root, 'skills'), { recursive: true })
  return root
}

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

function waitForExit(child: ReturnType<typeof spawn>, timeoutMs = 10_000) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CLI did not exit within ${timeoutMs} ms`)), timeoutMs)
    child.once('error', (error) => { clearTimeout(timer); reject(error) })
    child.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal }) })
  })
}

describe('CLI lifecycle', () => {
  it('closes cleanly when interactive stdin reaches EOF', async () => {
    const root = await tempRoot()
    const configPath = path.join(root, 'miniharness.yml')
    await writeFile(configPath, `projectRoot: .\nskillsDir: ./skills\nsessionDb: ./.miniharness/sessions.sqlite\nplugins: [logger, hooks, permission, tools, session]\n`)
    const child = spawn(process.execPath, ['--import', 'tsx', path.resolve('src/cli.ts'), '--config', configPath], {
      cwd: process.cwd(),
      env: { ...process.env, LOG_LEVEL: 'error' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    const exit = waitForExit(child)
    child.stdin?.end()
    const result = await exit
    expect(result.code).toBe(0)
    expect(output).toContain('[session]')
  })

  it.skipIf(process.platform === 'win32')('handles SIGTERM during a model request and persists an interrupted task', async () => {
    const root = await tempRoot()
    let announceRequest!: () => void
    const requestStarted = new Promise<void>((resolve) => { announceRequest = resolve })
    const api = createServer((request, response) => {
      request.resume()
      request.on('end', announceRequest)
      response.on('close', () => {})
    })
    await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve))
    const apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`
    const configPath = path.join(root, 'miniharness.yml')
    const dbPath = path.join(root, '.miniharness', 'sessions.sqlite')
    await writeFile(configPath, `projectRoot: .\nskillsDir: ./skills\nsessionDb: ./.miniharness/sessions.sqlite\napiBaseUrl: ${apiUrl}\nrequestTimeoutMs: 30000\nplugins: [logger, hooks, permission, llm, tools, skills, session, agent]\n`)
    const child = spawn(process.execPath, ['--import', 'tsx', path.resolve('src/cli.ts'), '--config', configPath, '--task', 'cancel me'], {
      cwd: process.cwd(),
      env: { ...process.env, DEEPSEEK_API_KEY: 'cli-test-key', LOG_LEVEL: 'error' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    const exit = waitForExit(child)
    try {
      await requestStarted
      child.kill('SIGTERM')
      expect(await exit).toMatchObject({ code: 143 })
      expect(output).toContain('interrupted; use :resume')
      const db = new DatabaseSync(dbPath)
      try {
        const row = db.prepare('SELECT status FROM tasks LIMIT 1').get() as { status: string } | undefined
        expect(row?.status).toBe('interrupted')
      } finally { db.close() }
    } finally {
      if (child.exitCode === null) child.kill('SIGKILL')
      await new Promise<void>((resolve) => api.close(() => resolve()))
    }
  })
})
