import { access, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'
import { ApprovalRejectedError, ApprovalTimeoutError, ApprovalUnavailableError, PermissionDeniedError } from '../src/plugins/permission.js'
import type { ApprovalHandler } from '../src/types.js'

const dirs: string[] = []
async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'miniharness-permission-'))
  dirs.push(dir)
  return dir
}
const configFor = (projectRoot: string, extra: Record<string, unknown> = {}) => configSchema.parse({
  projectRoot,
  plugins: ['logger', 'hooks', 'tools', 'permission'],
  ...extra,
})

afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

describe('permission plugin', () => {
  it('allows reads by default and denies writes until explicitly allowed', async () => {
    const root = await tempDir()
    await writeFile(path.join(root, 'sample.txt'), 'before')
    const denied = await createRuntime(configFor(root))
    try {
      expect((await denied.ctx.tools.execute('read_file', { path: 'sample.txt' })).content[0].text).toBe('before')
      await expect(denied.ctx.tools.execute('write_file', { path: 'sample.txt', content: 'after' })).rejects.toBeInstanceOf(PermissionDeniedError)
      expect(await readFile(path.join(root, 'sample.txt'), 'utf8')).toBe('before')
    } finally { await denied.dispose() }

    const allowed = await createRuntime(configFor(root, { permissions: { allow: ['write_file'] } }))
    try {
      await allowed.ctx.tools.execute('write_file', { path: 'sample.txt', content: 'after' })
      expect(await readFile(path.join(root, 'sample.txt'), 'utf8')).toBe('after')
    } finally { await allowed.dispose() }
  })

  it('gives the deny list precedence over allow and the default policy', async () => {
    const root = await tempDir()
    const runtime = await createRuntime(configFor(root, { permissions: { allow: ['write_file', 'read_file'], deny: ['write_file', 'read_file'], defaultWrite: 'allow' } }))
    try {
      await expect(runtime.ctx.tools.execute('write_file', { path: 'blocked.txt', content: 'no' })).rejects.toThrow(/deny list/)
      await expect(runtime.ctx.tools.execute('read_file', { path: 'missing.txt' })).rejects.toThrow(/deny list/)
    } finally { await runtime.dispose() }
  })

  it('can allow ordinary writes through the configured default policy', async () => {
    const root = await tempDir()
    const runtime = await createRuntime(configFor(root, { permissions: { defaultWrite: 'allow' } }))
    try {
      await runtime.ctx.tools.execute('write_file', { path: 'created.txt', content: 'allowed' })
      expect(await readFile(path.join(root, 'created.txt'), 'utf8')).toBe('allowed')
    } finally { await runtime.dispose() }
  })

  it('requires hooks and the permission plugin whenever tools are enabled', async () => {
    const root = await tempDir()
    await expect(createRuntime(configFor(root, { plugins: ['tools', 'hooks'] }))).rejects.toThrow(/requires "permission"/)
    await expect(createRuntime(configFor(root, { plugins: ['tools', 'permission'] }))).rejects.toThrow(/requires "hooks"/)
  })

  it('requires approval for dangerous tools even when allow-listed and binds approval to hooked arguments', async () => {
    const root = await tempDir()
    const approval = vi.fn<ApprovalHandler>(async (_request, _signal) => false)
    const runtime = await createRuntime(configFor(root, { permissions: { allow: ['run_shell'] } }), undefined, approval)
    try {
      runtime.ctx.on('tool/before', (call, args) => call.name === 'run_shell' ? { ...(args as object), command: 'echo reviewed-command' } : undefined)
      await expect(runtime.ctx.tools.execute('run_shell', { command: 'echo original-command' }, 'call-123')).rejects.toBeInstanceOf(ApprovalRejectedError)
      expect(approval).toHaveBeenCalledOnce()
      const request = approval.mock.calls[0][0]
      expect(request).toMatchObject({ callId: 'call-123', toolName: 'run_shell', args: { command: 'echo reviewed-command' } })
      expect(Object.isFrozen(request.args)).toBe(true)
    } finally { await runtime.dispose() }
  })

  it('executes the immutable argument snapshot approved by the user', async () => {
    const root = await tempDir()
    let startApproval!: () => void
    let decideApproval!: (value: boolean) => void
    const approvalStarted = new Promise<void>((resolve) => { startApproval = resolve })
    const approvalDecision = new Promise<boolean>((resolve) => { decideApproval = resolve })
    let executedCommand: unknown
    const runtime = await createRuntime(configFor(root), undefined, async () => {
      startApproval()
      return approvalDecision
    })
    runtime.ctx.tools.replaceSource('approval-snapshot', [{
      definition: { name: 'reviewed_command', description: 'A custom dangerous tool.', permission: 'dangerous', parameters: { type: 'object' } },
      validate: (args) => args as Record<string, unknown>,
      execute: (args) => { executedCommand = args.command; return { content: [], isError: false } },
    }])
    try {
      const args = { command: 'reviewed command' }
      const pending = runtime.ctx.tools.execute('reviewed_command', args)
      await approvalStarted
      args.command = 'mutated after approval began'
      decideApproval(true)
      await pending
      expect(executedCommand).toBe('reviewed command')
    } finally { await runtime.dispose() }
  })

  it('rejects dangerous tools without an interactive approval handler', async () => {
    const runtime = await createRuntime(configFor(await tempDir()))
    try {
      await expect(runtime.ctx.tools.execute('run_shell', { command: 'echo must-not-run' })).rejects.toBeInstanceOf(ApprovalUnavailableError)
    } finally { await runtime.dispose() }
  })

  it('executes the exact command shown in an approved request', async () => {
    const root = await tempDir()
    const command = `"${process.execPath}" -e "require('node:fs').writeFileSync('approved.txt','ok')"`
    const approval: ApprovalHandler = async (request) => request.args.command === command
    const runtime = await createRuntime(configFor(root), undefined, approval)
    try {
      await runtime.ctx.tools.execute('run_shell', { command }, 'approved-call')
      expect(await readFile(path.join(root, 'approved.txt'), 'utf8')).toBe('ok')
    } finally { await runtime.dispose() }
  })

  it('times out an unanswered dangerous call and does not execute it', async () => {
    const root = await tempDir()
    const approval: ApprovalHandler = () => new Promise<boolean>(() => {})
    const runtime = await createRuntime(configFor(root, { permissions: { approvalTimeoutMs: 10 } }), undefined, approval)
    try {
      await expect(runtime.ctx.tools.execute('run_shell', { command: 'echo must-not-run' })).rejects.toBeInstanceOf(ApprovalTimeoutError)
    } finally { await runtime.dispose() }
  })

  it('cancels a pending dangerous approval before the operation starts', async () => {
    const root = await tempDir()
    const approval = vi.fn<ApprovalHandler>((_request, signal) => new Promise<boolean>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const runtime = await createRuntime(configFor(root), undefined, approval)
    const controller = new AbortController()
    const command = `"${process.execPath}" -e "require('node:fs').writeFileSync('cancelled.txt','no')"`
    try {
      const pending = runtime.ctx.tools.execute('run_shell', { command }, 'cancel-approval', { signal: controller.signal })
      await vi.waitFor(() => expect(approval).toHaveBeenCalledOnce())
      controller.abort(new Error('approval cancelled'))
      await expect(pending).rejects.toThrow(/approval cancelled/)
      await expect(access(path.join(root, 'cancelled.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally { await runtime.dispose() }
  })

  it('rejects writes that escape the root or follow an outside symlink', async () => {
    const root = await tempDir()
    const outside = await tempDir()
    await writeFile(path.join(outside, 'secret.txt'), 'secret')
    const runtime = await createRuntime(configFor(root, { permissions: { allow: ['write_file'] } }))
    try {
      await expect(runtime.ctx.tools.execute('write_file', { path: '../outside.txt', content: 'bad' })).rejects.toThrow(/escapes/)
      if (process.platform !== 'win32') {
        await symlink(path.join(outside, 'secret.txt'), path.join(root, 'link.txt'))
        await expect(runtime.ctx.tools.execute('write_file', { path: 'link.txt', content: 'bad' })).rejects.toThrow(/escapes/)
      }
      expect(await readFile(path.join(outside, 'secret.txt'), 'utf8')).toBe('secret')
    } finally { await runtime.dispose() }
  })
})
