import { exec as execCallback } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { lstat, open, realpath, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { Context } from 'cordis'
import type { RuntimeConfig } from '../config.js'
import '../services.js'
import type { ToolCall, ToolDefinition, ToolRegistration, ToolResult, ToolService } from '../types.js'
import { PermissionDeniedError, ToolExecutionError } from './permission.js'

const exec = promisify(execCallback)
const definitions: ToolDefinition[] = [
  { name: 'list_files', description: 'List project files, optionally under a relative directory.', permission: 'read', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative directory, default .' } }, additionalProperties: false } },
  { name: 'search_text', description: 'Search project text files for a string or regular expression and return matching lines.', permission: 'read', parameters: { type: 'object', properties: { query: { type: 'string' }, path: { type: 'string', description: 'Relative file or directory, default .' } }, required: ['query'], additionalProperties: false } },
  { name: 'read_file', description: 'Read a UTF-8 text file inside the project.', permission: 'read', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } },
  { name: 'write_file', description: 'Create or replace a UTF-8 text file inside the project. Requires write permission.', permission: 'write', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false } },
  { name: 'run_shell', description: 'Run a shell command from the project root. Every call requires human approval.', permission: 'dangerous', parameters: { type: 'object', properties: { command: { type: 'string', minLength: 1 } }, required: ['command'], additionalProperties: false } },
]
const ignored = new Set(['.git', '.miniharness', 'node_modules', 'dist', 'coverage'])
const maxShellBuffer = 1_048_576
const maxShellOutput = 30_000

function truncateShellOutput(value: string | Buffer | undefined): string {
  const text = String(value ?? '')
  return text.length > maxShellOutput ? `${text.slice(0, maxShellOutput)}\n[truncated]` : text
}
const inputSchemas = {
  list_files: z.object({ path: z.string().optional() }).strict(),
  search_text: z.object({ query: z.string().min(1), path: z.string().optional() }).strict(),
  read_file: z.object({ path: z.string().min(1) }).strict(),
  write_file: z.object({ path: z.string().min(1), content: z.string() }).strict(),
  run_shell: z.object({ command: z.string().min(1) }).strict(),
}

function normalizeBuiltinResult(value: unknown): ToolResult {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
  return {
    content: [{ type: 'text', text }],
    isError: false,
    ...(value !== null && typeof value === 'object' ? { structuredContent: value } : {}),
  }
}

function within(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function freezeArgs<T extends Record<string, unknown>>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') freezeArgs(child as Record<string, unknown>)
    }
  }
  return value
}

async function awaitWithSignal<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
  let rejectAbort!: () => void
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', rejectAbort, { once: true })
  })
  try { return await Promise.race([operation, aborted]) }
  finally { signal.removeEventListener('abort', rejectAbort) }
}

export function createToolsPlugin(config: RuntimeConfig) {
  return {
    name: 'tools',
    inject: ['hooks', 'permission'],
    apply(ctx: Context) {
      const rootPromise = realpath(config.projectRoot)
      const sessionDbDir = path.resolve(path.dirname(config.sessionDb))
      const sessionDbPath = path.resolve(config.sessionDb)
      let canonicalSessionDbDir: string | undefined
      async function assertNotSessionData(candidate: string) {
        if (!canonicalSessionDbDir) {
          try { canonicalSessionDbDir = await realpath(sessionDbDir) } catch { /* Keep checking the resolved path below. */ }
        }
        const canonicalDbDir = canonicalSessionDbDir ?? sessionDbDir
        const root = await rootPromise
        if (canonicalDbDir !== root && within(canonicalDbDir, candidate)) throw new Error('Session data is not available to file tools')
        if (canonicalDbDir === root) {
          const canonicalDb = await realpath(sessionDbPath).catch(() => sessionDbPath)
          if (candidate === canonicalDb || candidate.startsWith(`${canonicalDb}-`)) throw new Error('Session data is not available to file tools')
        }
      }
      function assertRelative(relative: string) {
        if (relative.split(/[\\/]+/).includes('.miniharness')) throw new Error('Session data is not available to file tools')
        if (path.isAbsolute(relative)) throw new Error('Absolute paths are not allowed')
      }
      async function checkComponents(relative: string, allowMissingFinal = false): Promise<string> {
        assertRelative(relative)
        const root = await rootPromise
        const resolved = path.resolve(root, relative)
        if (!within(root, resolved)) throw new Error('Path escapes the project root')
        const parts = path.relative(root, resolved).split(path.sep).filter(Boolean)
        let current = root
        for (let index = 0; index < parts.length; index++) {
          current = path.join(current, parts[index])
          let info
          try { info = await lstat(current) } catch (error) {
            if (allowMissingFinal && index === parts.length - 1 && (error as NodeJS.ErrnoException).code === 'ENOENT') break
            throw error
          }
          if (info.isSymbolicLink()) throw new Error('Symbolic links are not allowed')
          if (index < parts.length - 1 && !info.isDirectory()) throw new Error('A path component is not a directory')
        }
        await assertNotSessionData(resolved)
        return resolved
      }
      async function verifyOpenedFile(candidate: string, handle: Awaited<ReturnType<typeof open>>, mustExist: boolean) {
        const opened = await handle.stat()
        if (!opened.isFile()) throw new Error('path is not a regular file')
        const currentPath = await lstat(candidate)
        if (currentPath.isSymbolicLink() || !currentPath.isFile() || currentPath.dev !== opened.dev || currentPath.ino !== opened.ino) {
          throw new Error('File changed while it was being opened')
        }
        const canonical = await realpath(candidate)
        const root = await rootPromise
        if (!within(root, canonical)) throw new Error('Path escapes the project root')
        await assertNotSessionData(canonical)
        if (!mustExist && !within(root, candidate)) throw new Error('Path escapes the project root')
      }
      async function readSafeFile(relative: string, signal?: AbortSignal): Promise<string> {
        const file = await checkComponents(relative)
        if (!(await lstat(file)).isFile()) throw new Error('path is not a regular file')
        const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
        const handle = await open(file, flags)
        try {
          await verifyOpenedFile(file, handle, true)
          return await handle.readFile({ encoding: 'utf8', signal })
        } finally { await handle.close() }
      }
      async function writeSafeFile(relative: string, content: string, signal?: AbortSignal): Promise<void> {
        const file = await checkComponents(relative, true)
        const noFollow = fsConstants.O_NOFOLLOW ?? 0
        let handle: Awaited<ReturnType<typeof open>>
        try {
          const existing = await lstat(file)
          if (existing.isSymbolicLink()) throw new Error('Symbolic links are not allowed')
          if (!existing.isFile()) throw new Error('path is not a regular file')
          handle = await open(file, fsConstants.O_WRONLY | noFollow)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          handle = await open(file, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollow, 0o666)
        }
        try {
          await verifyOpenedFile(file, handle, false)
          if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
          await handle.truncate(0)
          await handle.writeFile(content, { encoding: 'utf8', signal })
        } finally { await handle.close() }
      }
      async function walk(dir: string, results: string[], base: string): Promise<void> {
        const visited = new Set<string>()
        const visit = async (directory: string): Promise<void> => {
          const checked = await checkComponents(path.relative(base, directory) || '.')
          const canonical = await realpath(checked)
          if (!within(await rootPromise, canonical)) throw new Error('Path escapes the project root')
          await assertNotSessionData(canonical)
          if (visited.has(canonical)) return
          visited.add(canonical)
          for (const entry of await readdir(canonical, { withFileTypes: true })) {
            if (ignored.has(entry.name)) continue
            const full = path.join(canonical, entry.name)
            const relative = path.relative(base, full).split(path.sep).join('/')
            if (entry.isSymbolicLink()) continue
            if (entry.isDirectory()) await visit(full)
            else if (entry.isFile()) results.push(relative)
          }
        }
        await visit(dir)
      }

      async function executeRegistered(name: keyof typeof inputSchemas, args: Record<string, unknown>, signal?: AbortSignal) {
        if (name === 'list_files') {
          const directory = await checkComponents(typeof args.path === 'string' ? args.path : '.')
          const files: string[] = []
          await walk(directory, files, await rootPromise)
          return files.sort().slice(0, 500)
        }
        if (name === 'read_file') {
          const content = await readSafeFile(args.path as string, signal)
          return content.length > 30_000 ? `${content.slice(0, 30_000)}\n[truncated]` : content
        }
        if (name === 'search_text') {
          const start = await checkComponents(typeof args.path === 'string' ? args.path : '.')
          const matches: Array<{ path: string; line: number; text: string }> = []
          const files: string[] = []
          if ((await stat(start)).isDirectory()) await walk(start, files, await rootPromise)
          else files.push(path.relative(await rootPromise, start).split(path.sep).join('/'))
          let pattern: RegExp
          try { pattern = new RegExp(args.query as string, 'i') } catch { pattern = new RegExp((args.query as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
          for (const file of files.slice(0, 500)) {
            if (/\.(png|jpe?g|gif|pdf|zip|lock|woff2?)$/i.test(file)) continue
            try {
              const contents = await readSafeFile(file, signal)
              contents.split(/\r?\n/).forEach((text, index) => { if (pattern.test(text) && matches.length < 200) matches.push({ path: file, line: index + 1, text: text.slice(0, 500) }) })
            } catch { /* Skip unreadable/binary files. */ }
          }
          return matches
        }
        if (name === 'write_file') {
          await writeSafeFile(args.path as string, args.content as string, signal)
          return { path: args.path, bytes: Buffer.byteLength(args.content as string), written: true }
        }
        if (name === 'run_shell') {
          try {
            const { stdout, stderr } = await exec(args.command as string, {
              cwd: await rootPromise,
              timeout: 60_000,
              maxBuffer: maxShellBuffer,
              windowsHide: true,
              ...(signal ? { signal } : {}),
            })
            return { stdout: truncateShellOutput(stdout), stderr: truncateShellOutput(stderr) }
          } catch (cause) {
            const error = cause as Error & { code?: string | number | null; signal?: string | null; stdout?: string | Buffer; stderr?: string | Buffer }
            const exit = error.code != null ? `exit ${error.code}` : error.signal ? `signal ${error.signal}` : 'timed out or killed'
            const stdout = truncateShellOutput(error.stdout)
            const stderr = truncateShellOutput(error.stderr ?? error.message)
            const details = `${stdout ? `\nstdout:\n${stdout}` : ''}${stderr ? `\nstderr:\n${stderr}` : ''}`
            throw new ToolExecutionError(`Shell command failed (${exit}): ${error.message}${details}`, 'dangerous', { cause: error })
          }
        }
        throw new Error(`Unknown tool: ${name}`)
      }

      const registry = new Map<string, { sourceId: string; registration: ToolRegistration }>()
      for (const definition of definitions) {
        const name = definition.name as keyof typeof inputSchemas
        registry.set(definition.name, {
          sourceId: 'builtin',
          registration: {
            definition,
            validate(args) { return inputSchemas[name].parse(args) as Record<string, unknown> },
            async execute(args, options) { return normalizeBuiltinResult(await executeRegistered(name, args, options?.signal)) },
          },
        })
      }

      const service: ToolService = {
        definitions: () => [...registry.values()].map(({ registration }) => ({ ...registration.definition })),
        replaceSource(sourceId, registrations) {
          const ownedNames = new Set([...registry].filter(([, entry]) => entry.sourceId === sourceId).map(([name]) => name))
          const seen = new Set<string>()
          const accepted: ToolRegistration[] = []
          const conflicts: string[] = []
          for (const registration of registrations) {
            const name = registration.definition.name
            const existing = registry.get(name)
            if (seen.has(name) || (existing && existing.sourceId !== sourceId)) {
              conflicts.push(name)
              continue
            }
            seen.add(name)
            accepted.push(registration)
          }
          for (const name of ownedNames) registry.delete(name)
          for (const registration of accepted) {
            registry.set(registration.definition.name, { sourceId, registration })
          }
          return { registered: accepted.map(({ definition }) => definition.name), conflicts }
        },
        removeSource(sourceId) {
          for (const [name, entry] of registry) if (entry.sourceId === sourceId) registry.delete(name)
        },
        async execute(rawName, rawArgs, suppliedCallId, options = {}) {
          const entry = registry.get(rawName)
          const registration = entry?.registration
          const definition = registration?.definition
          if (!registration || !definition) throw new PermissionDeniedError(`Unknown tool: ${rawName}`)
          const callId = suppliedCallId ?? randomUUID()
          const call: ToolCall = { id: callId, name: rawName, arguments: JSON.stringify(rawArgs) }
          let finalArgs = rawArgs
          let result: ToolResult | undefined
          let error: Error | undefined
          const session = options.taskId ? ctx.get('session') : undefined
          let attemptStarted = false
          try {
            if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Aborted', 'AbortError')
            if (session && options.attempt !== undefined) {
              session.startAttempt(callId, options.attempt)
              attemptStarted = true
            }
            const hooked = await awaitWithSignal(ctx.hooks.beforeTool(call, rawArgs), options.signal)
            if (hooked === false) throw new PermissionDeniedError(`Tool "${rawName}" was blocked by a hook`)
            const parsed = freezeArgs(structuredClone(registration.validate(hooked)))
            finalArgs = parsed
            await ctx.permission.authorize(definition, parsed, callId, options.signal)
            try {
              result = await awaitWithSignal(Promise.resolve(registration.execute(parsed, options)), options.signal)
            } catch (cause) {
              if (options.signal?.aborted) throw cause
              if (cause instanceof ToolExecutionError) throw cause
              throw new ToolExecutionError((cause as Error).message, definition.permission, { cause })
            }
            if (!result) throw new ToolExecutionError('Tool returned no result', definition.permission)
            return result
          } catch (cause) {
            error = cause instanceof Error ? cause : new Error(String(cause))
            throw error
          } finally {
            if (attemptStarted && session && options.attempt !== undefined) {
              const errorCode = error && 'code' in error ? String(error.code) : undefined
              const approval = errorCode === 'APPROVAL_REJECTED' ? 'rejected'
                : errorCode === 'APPROVAL_TIMEOUT' ? 'timeout'
                  : errorCode === 'APPROVAL_UNAVAILABLE' ? 'unavailable'
                    : definition.permission === 'dangerous' && !error ? 'approved' : undefined
              const toolReportedError = !error && result?.isError === true
              session.finishAttempt(callId, options.attempt, options.signal?.aborted ? 'unknown' : error || toolReportedError ? 'failed' : 'succeeded', {
                ...(errorCode ? { errorCode } : toolReportedError ? { errorCode: 'TOOL_REPORTED_ERROR' } : {}),
                ...(error ? { error: error.message } : toolReportedError ? { error: result?.content.map((item) => String(item.text ?? '')).join('\n').slice(0, 1000) || 'Tool reported an error' } : {}),
                ...(approval ? { approval } : {}),
              })
            }
            await awaitWithSignal(ctx.hooks.afterTool(call, finalArgs, result, error), options.signal)
          }
        },
      }
      ctx.set('tools', service)
    },
  }
}
