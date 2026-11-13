import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configSchema } from '../src/config.js'
import { createRuntime } from '../src/runtime.js'
import type { SkillMetadata } from '../src/types.js'

const dirs: string[] = []
async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'miniharness-skills-'))
  dirs.push(dir)
  return dir
}
const configFor = (root: string) => configSchema.parse({ projectRoot: root, skillsDir: path.join(root, 'skills'), plugins: ['logger', 'llm', 'skills'] })
const skillSource = (description: string, body: string) => `---\nname: repo-analysis\ndescription: ${description}\ntags: [repository, code]\n---\n${body}`

afterEach(async () => {
  delete process.env.DEEPSEEK_API_KEY
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('Skills Registry', () => {
  it('caches valid metadata, skips malformed files, and lazily caches selected bodies', async () => {
    const root = await tempDir()
    const skillDir = path.join(root, 'skills', 'repo-analysis')
    const invalidDir = path.join(root, 'skills', 'broken')
    await mkdir(skillDir, { recursive: true })
    await mkdir(invalidDir)
    const skillPath = path.join(skillDir, 'SKILL.md')
    await writeFile(skillPath, skillSource('Analyze repository structure.', 'Original workflow.'))
    await writeFile(path.join(invalidDir, 'SKILL.md'), 'This file has no frontmatter.')
    const runtime = await createRuntime(configFor(root))
    try {
      expect(runtime.ctx.skills.list()).toEqual([{ name: 'repo-analysis', description: 'Analyze repository structure.', tags: ['repository', 'code'] }])
      await writeFile(skillPath, skillSource('Changed after startup.', 'Updated workflow.'))
      expect(runtime.ctx.skills.list()[0].description).toBe('Analyze repository structure.')
      const firstLoad = await runtime.ctx.skills.load('repo-analysis')
      expect(firstLoad.content).toBe('Updated workflow.')
      await writeFile(skillPath, skillSource('Changed again.', 'Latest workflow.'))
      expect((await runtime.ctx.skills.load('repo-analysis')).content).toBe('Updated workflow.')
      await expect(runtime.ctx.skills.load('missing')).rejects.toThrow('Unknown Skill')
    } finally { await runtime.dispose() }
  })

  it('starts with a missing directory and reports an empty registry', async () => {
    const root = await tempDir()
    const runtime = await createRuntime(configFor(root))
    try { expect(runtime.ctx.skills.list()).toEqual([]) }
    finally { await runtime.dispose() }
  })

  it('rejects a Skill body beyond the size limit', async () => {
    const root = await tempDir()
    const skillDir = path.join(root, 'skills', 'repo-analysis')
    await mkdir(skillDir, { recursive: true })
    await writeFile(path.join(skillDir, 'SKILL.md'), skillSource('Large body.', 'x'.repeat(300 * 1024)))
    const runtime = await createRuntime(configFor(root))
    try {
      await expect(runtime.ctx.skills.load('repo-analysis')).rejects.toThrow(/exceeds 256 KiB limit/)
    } finally { await runtime.dispose() }
  })

  it('uses structured JSON selection, filters unknown and duplicate names, and supports composition', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    const payloads = [
      '{"skills":["repo-analysis","unknown","repo-analysis"]}',
      '{"skills":["code-review","bug-investigation","repo-analysis","repo-analysis"]}',
      '{"skills":[]}',
    ]
    const bodies: Array<Record<string, unknown>> = []
    const fakeFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      bodies.push(body)
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: payloads.shift() } }] }), { status: 200 })
    }) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    const candidates: SkillMetadata[] = [
      { name: 'repo-analysis', description: 'Analyze a repository.', tags: ['code'] },
      { name: 'code-review', description: 'Review code.', tags: ['review'] },
      { name: 'bug-investigation', description: 'Investigate a defect.', tags: ['debug'] },
    ]
    try {
      expect(await runtime.ctx.llm.selectSkills('Understand the project', candidates, 3)).toEqual(['repo-analysis'])
      expect(await runtime.ctx.llm.selectSkills('Review this change', candidates, 3)).toEqual(['code-review', 'bug-investigation', 'repo-analysis'])
      expect(await runtime.ctx.llm.selectSkills('Say hello', candidates, 3)).toEqual([])
      expect(bodies[0]).toMatchObject({ response_format: { type: 'json_object' }, max_tokens: 512 })
    } finally { await runtime.dispose() }
  })

  it('fails on malformed structured output and selection API errors', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-secret'
    const root = await tempDir()
    let malformed = true
    const fakeFetch = vi.fn(async () => malformed
      ? new Response(JSON.stringify({ choices: [{ message: { content: '{"skills":"repo-analysis"}' } }] }), { status: 200 })
      : new Response('unavailable', { status: 503 })) as typeof fetch
    const runtime = await createRuntime(configFor(root), fakeFetch)
    const candidates: SkillMetadata[] = [{ name: 'repo-analysis', description: 'Analyze repositories.', tags: [] }]
    try {
      await expect(runtime.ctx.llm.selectSkills('Analyze', candidates, 3)).rejects.toThrow(/invalid Skill selection/)
      malformed = false
      await expect(runtime.ctx.llm.selectSkills('Analyze', candidates, 3)).rejects.toThrow('DeepSeek API 503')
    } finally { await runtime.dispose() }
  })
})
