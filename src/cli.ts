#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { Command } from 'commander'
import { loadConfig } from './config.js'
import { createRuntime } from './runtime.js'
import type { AgentEvent, ApprovalHandler } from './types.js'
import { TaskPausedError } from './plugins/agent.js'

const program = new Command()
program.name('miniharness').description('A lightweight plugin-based agent runtime').option('-c, --config <path>', 'YAML config file', 'miniharness.yml').option('-t, --task <task>', 'run one task and exit').option('-s, --session <id>', 'use an existing session')
program.addHelpText('after', '\nInteractive commands:\n  :session new          Create and switch to a new session\n  :session list         List sessions\n  :session use <id>     Switch sessions\n  :tasks                List tasks in the active session\n  :resume <task-id>     Resume a paused or interrupted task\n')
program.parse()
const options = program.opts<{ config: string; task?: string; session?: string }>()

function showEvent(event: AgentEvent) {
  switch (event.type) {
    case 'skills.selecting': stdout.write(`\n[skills] matching task against ${event.candidates} available Skill(s)\n`); break
    case 'skills.selected': stdout.write(`[skills] selected: ${event.names.length ? event.names.join(', ') : '(none)'}\n`); break
    case 'skills.loaded': stdout.write(`[skills] loaded ${event.name}\n`); break
    case 'model.request': stdout.write(`\n[model] request #${event.iteration}\n`); break
    case 'tool.start': stdout.write(`[tool] ${event.name} started\n`); break
    case 'tool.end': {
      const preview = event.error ? '' : (typeof event.result === 'string' ? event.result : JSON.stringify(event.result) ?? '').replace(/\s+/g, ' ').slice(0, 180)
      stdout.write(`[tool] ${event.name} ${event.error ? `failed: ${event.error}` : `completed${preview ? ` — ${preview}` : ''}`}\n`)
      break
    }
    case 'agent.paused': stdout.write(`[task] paused at iteration ${event.iteration}; resume with :resume ${event.taskId}\n`); break
    case 'agent.final': stdout.write(`\n${event.answer}\n`); break
  }
}

async function main() {
  const config = await loadConfig(options.config)
  const rl = createInterface({ input: stdin, output: stdout })
  let activeController: AbortController | undefined
  let inputClosed = false
  let signalExitCode = 0
  const cancel = (name: 'SIGINT' | 'SIGTERM') => {
    signalExitCode = name === 'SIGINT' ? 130 : 143
    activeController?.abort(new Error(`Received ${name}`))
    rl.close()
  }
  const onSigint = () => cancel('SIGINT')
  const onSigterm = () => cancel('SIGTERM')
  const onClose = () => { inputClosed = true; activeController?.abort(new Error('Standard input closed')) }
  process.on('SIGINT', onSigint)
  process.on('SIGTERM', onSigterm)
  rl.on('close', onClose)
  const canApprove = Boolean(stdin.isTTY && stdout.isTTY)
  const approve: ApprovalHandler | undefined = canApprove ? async (request, signal) => {
    stdout.write(`\n[approval required] ${request.toolName} (${request.permission})\n`)
    stdout.write(`Call: ${JSON.stringify(request.args)}\nWorking directory: ${config.projectRoot}\n`)
    const answer = await rl.question('Approve this exact call? [y/N] ', { signal })
    return /^(y|yes|approve)$/i.test(answer.trim())
  } : undefined
  let runtime: Awaited<ReturnType<typeof createRuntime>> | undefined
  const runTask = async (action: (signal: AbortSignal) => Promise<string>) => {
    const controller = new AbortController()
    activeController = controller
    try { return await action(controller.signal) }
    finally { if (activeController === controller) activeController = undefined }
  }
  try {
    runtime = await createRuntime(config, undefined, approve)
    let activeSession = options.session ? runtime.ctx.session.getSession(options.session) : runtime.ctx.session.createSession()
    stdout.write(`[session] ${activeSession.id}\n`)
    if (options.task) {
      try { await runTask((signal) => runtime!.ctx.agent.run(options.task!, activeSession.id, showEvent, signal)) }
      catch (error) {
        const latest = runtime.ctx.session.listTasks(activeSession.id)[0]
        if (latest?.status === 'interrupted') stdout.write(`[task] interrupted; use :resume ${latest.id} to continue\n`)
        else throw error
      }
      return
    }
    while (true) {
      let line: string
      try { line = await rl.question('miniharness> ') }
      catch (error) { if (inputClosed || stdin.destroyed) break; throw error }
      const task = line.trim()
      if (/^(exit|quit)$/i.test(task)) break
      if (task.startsWith(':session')) {
        const [, action, value] = task.split(/\s+/, 3)
        try {
          if (action === 'new') {
            activeSession = runtime.ctx.session.createSession()
            stdout.write(`[session] switched to ${activeSession.id}\n`)
          } else if (action === 'list') {
            for (const session of runtime.ctx.session.listSessions()) stdout.write(`${session.id}${session.id === activeSession.id ? ' *' : ''}  ${session.createdAt}\n`)
          } else if (action === 'use' && value) {
            activeSession = runtime.ctx.session.getSession(value)
            stdout.write(`[session] switched to ${activeSession.id}\n`)
          } else stdout.write('Usage: :session new | list | use <id>\n')
        } catch (error) { console.error(`[error] ${(error as Error).message}`) }
        continue
      }
      if (task === ':tasks') {
        for (const record of runtime.ctx.session.listTasks(activeSession.id)) stdout.write(`${record.id}  ${record.status}  ${record.prompt.slice(0, 100)}\n`)
        continue
      }
      if (task.startsWith(':resume')) {
        const taskId = task.split(/\s+/, 2)[1]
        if (!taskId) { stdout.write('Usage: :resume <task-id>\n'); continue }
        try {
          const record = runtime.ctx.session.getTask(taskId)
          activeSession = runtime.ctx.session.getSession(record.sessionId)
          await runTask((signal) => runtime!.ctx.agent.resume(taskId, showEvent, signal))
        } catch (error) {
          if (error instanceof TaskPausedError) stdout.write(`${error.message}\n`)
          else {
            const record = runtime.ctx.session.getTask(taskId)
            if (record.status === 'interrupted') stdout.write(`[task] interrupted; use :resume ${taskId} to continue\n`)
            else console.error(`[error] ${(error as Error).message}`)
          }
        }
        continue
      }
      if (task) {
        try { await runTask((signal) => runtime!.ctx.agent.run(task, activeSession.id, showEvent, signal)) }
        catch (error) {
          if (error instanceof TaskPausedError) stdout.write(`${error.message}\n`)
          else {
            const latest = runtime.ctx.session.listTasks(activeSession.id)[0]
            if (latest?.status === 'interrupted') stdout.write(`[task] interrupted; use :resume ${latest.id} to continue\n`)
            else console.error(`[error] ${(error as Error).message}`)
          }
        }
      }
    }
  } finally {
    process.off('SIGINT', onSigint)
    process.off('SIGTERM', onSigterm)
    rl.off('close', onClose)
    rl.close()
    if (runtime) {
      let timer: ReturnType<typeof setTimeout> | undefined
      try { await Promise.race([
        runtime.dispose(),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            console.error('[miniharness] cleanup exceeded 5 seconds; forcing exit')
            process.exit(signalExitCode || 1)
          }, 5_000)
        }),
      ]) } finally { if (timer) clearTimeout(timer) }
    }
    if (signalExitCode) process.exitCode = signalExitCode
  }
}

main().catch((error) => {
  console.error(`[miniharness] ${(error as Error).message}`)
  if (!process.exitCode) process.exitCode = 1
})
