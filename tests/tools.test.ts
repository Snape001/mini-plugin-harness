import { lstat, mkdtemp, mkdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'

const dirs: string[] = []
async function tempDir() { const dir = await mkdtemp(path.join(os.tmpdir(), 'miniharness-tools-')); dirs.push(dir); return dir }
const configFor = (projectRoot: string, extra: Record<string, unknown> = {}) => configSchema.parse({ projectRoot, skillsDir: path.join(projectRoot, 'skills'), sessionDb: path.join(projectRoot, '.miniharness', 'sessions.sqlite'), plugins: ['logger', 'hooks', 'llm', 'tools', 'skills', 'permission', 'session'], ...extra })

afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

describe('project tools', () => {
  it('lists, searches, and reads project files', async () => {
    const root = await tempDir()
    await mkdir(path.join(root, 'src'))
    await writeFile(path.join(root, 'src', 'sample.ts'), 'export function greet() { return "hi" }\n')
    const runtime = await createRuntime(configFor(root), fetch)
    try {
      expect((await runtime.ctx.tools.execute('list_files', {})).structuredContent).toContain('src/sample.ts')
      expect((await runtime.ctx.tools.execute('search_text', { query: 'greet' })).structuredContent).toMatchObject([{ path: 'src/sample.ts', line: 1 }])
      expect((await runtime.ctx.tools.execute('read_file', { path: 'src/sample.ts' })).content[0].text).toContain('function greet')
      await expect(runtime.ctx.tools.execute('read_file', { path: 'src/sample.ts', extra: true })).rejects.toThrow()
      await expect(runtime.ctx.tools.execute('read_file', { path: '../outside.txt' })).rejects.toThrow(/escapes/)
      await expect(runtime.ctx.tools.execute('read_file', { path: path.join(root, 'src', 'sample.ts') })).rejects.toThrow(/Absolute/)
      await expect(runtime.ctx.tools.execute('read_file', { path: '.miniharness/sessions.sqlite' })).rejects.toThrow(/Session data/)
    } finally { await runtime.dispose() }
  })

  it('truncates large shell output without killing the process', async () => {
    const root = await tempDir()
    const runtime = await createRuntime(configFor(root), fetch, async () => true)
    try {
      const command = `"${process.execPath}" -e "process.stdout.write('x'.repeat(40000))"`
      const result = await runtime.ctx.tools.execute('run_shell', { command }, 'large-output')
      const output = result.structuredContent as { stdout: string; stderr: string }
      expect(output.stdout.endsWith('\n[truncated]')).toBe(true)
      expect(output.stdout.length).toBe(30_000 + '\n[truncated]'.length)
    } finally { await runtime.dispose() }
  })

  it('preserves exit code, stdout, and stderr for a failed shell command', async () => {
    const root = await tempDir()
    const runtime = await createRuntime(configFor(root), fetch, async () => true)
    try {
      const command = `"${process.execPath}" -e "console.log('out'); console.error('err'); process.exit(3)"`
      await expect(runtime.ctx.tools.execute('run_shell', { command }, 'nonzero')).rejects.toThrow(/exit 3[\s\S]*stdout:[\s\S]*out[\s\S]*stderr:[\s\S]*err/)
    } finally { await runtime.dispose() }
  })

  it.skipIf(process.platform === 'win32')('rejects symlinks that escape the project root', async () => {
    const root = await tempDir()
    const outside = await tempDir()
    await writeFile(path.join(outside, 'secret.txt'), 'secret')
    await symlink(path.join(outside, 'secret.txt'), path.join(root, 'secret.txt'))
    const runtime = await createRuntime(configFor(root), fetch)
    try { await expect(runtime.ctx.tools.execute('read_file', { path: 'secret.txt' })).rejects.toThrow(/escapes/) }
    finally { await runtime.dispose() }
  })

  it.skipIf(process.platform === 'win32')('rejects project symlinks and never follows them during traversal', async () => {
    const root = await tempDir()
    await mkdir(path.join(root, 'real'))
    await writeFile(path.join(root, 'real', 'inside.txt'), 'inside')
    await symlink(path.join(root, 'real'), path.join(root, 'alias'))
    const runtime = await createRuntime(configFor(root), fetch)
    try {
      await expect(runtime.ctx.tools.execute('read_file', { path: 'alias/inside.txt' })).rejects.toThrow(/Symbolic links/)
      const files = (await runtime.ctx.tools.execute('list_files', {})).structuredContent as string[]
      expect(files).toContain('real/inside.txt')
      expect(files).not.toContain('alias/inside.txt')
    } finally { await runtime.dispose() }
  })

  it.skipIf(process.platform === 'win32')('does not read outside content while a checked parent directory is replaced', async () => {
    const root = await tempDir()
    const outside = await tempDir()
    const active = path.join(root, 'active')
    const parked = path.join(root, 'parked')
    await mkdir(active)
    await writeFile(path.join(active, 'value.txt'), 'inside')
    await writeFile(path.join(outside, 'value.txt'), 'outside-secret')
    const runtime = await createRuntime(configFor(root), fetch)
    let swapping = true
    let announceFirstLink!: () => void
    const firstLink = new Promise<void>((resolve) => { announceFirstLink = resolve })
    const swapLoop = (async () => {
      while (swapping) {
        try {
          await rename(active, parked)
          await symlink(outside, active, 'dir')
          announceFirstLink()
          await new Promise((resolve) => setImmediate(resolve))
          await rm(active, { recursive: true, force: true })
          await rename(parked, active)
        } catch {
          swapping = false
        }
      }
    })()
    try {
      let linkTimer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([firstLink, new Promise((_, reject) => { linkTimer = setTimeout(() => reject(new Error('directory replacement did not start')), 2_000) })])
      } finally { if (linkTimer) clearTimeout(linkTimer) }
      const values = await Promise.all(Array.from({ length: 80 }, async () => {
        try { return (await runtime.ctx.tools.execute('read_file', { path: 'active/value.txt' })).content[0].text }
        catch { return undefined }
      }))
      expect(values.filter(Boolean).every((value) => value === 'inside')).toBe(true)
      expect(values).not.toContain('outside-secret')
    } finally {
      swapping = false
      await swapLoop
      try {
        await lstat(parked)
        await rm(active, { recursive: true, force: true })
        await rename(parked, active)
      } catch { /* The swap loop may already have restored it. */ }
      await runtime.dispose()
    }
  })

  it('rejects directories when a tool expects a regular file handle', async () => {
    const root = await tempDir()
    await mkdir(path.join(root, 'directory'))
    const runtime = await createRuntime(configFor(root, { permissions: { allow: ['write_file'] } }), fetch)
    try {
      await expect(runtime.ctx.tools.execute('read_file', { path: 'directory' })).rejects.toThrow(/regular file/)
      await expect(runtime.ctx.tools.execute('write_file', { path: 'directory', content: 'x' })).rejects.toThrow(/regular file/)
    } finally { await runtime.dispose() }
  })

  it('protects a session database stored directly under the project root without hiding sibling files', async () => {
    const root = await tempDir()
    await writeFile(path.join(root, 'ordinary.txt'), 'ordinary')
    const runtime = await createRuntime(configFor(root, { sessionDb: path.join(root, 'sessions.sqlite') }), fetch)
    try {
      await expect(runtime.ctx.tools.execute('read_file', { path: 'sessions.sqlite' })).rejects.toThrow(/Session data/)
      expect((await runtime.ctx.tools.execute('read_file', { path: 'ordinary.txt' })).content[0].text).toBe('ordinary')
    } finally { await runtime.dispose() }
  })
})
