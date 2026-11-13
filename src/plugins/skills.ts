import { open, readdir, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { z } from 'zod'
import type { Context } from 'cordis'
import type { RuntimeConfig } from '../config.js'
import '../services.js'
import type { SkillDocument, SkillMetadata, SkillService } from '../types.js'

const metadataSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  description: z.string().trim().min(1).max(1000),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
}).passthrough()

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const maxFrontmatterBytes = 64 * 1024
const maxSkillBytes = 256 * 1024

function parseSkill(source: string, entry: string, requireContent = true): SkillDocument {
  const match = source.match(frontmatterPattern)
  if (!match) throw new Error('missing YAML frontmatter delimited by ---')
  let rawMetadata: unknown
  try { rawMetadata = loadYaml(match[1]) } catch (error) { throw new Error(`invalid YAML frontmatter: ${(error as Error).message}`) }
  const parsed = metadataSchema.safeParse(rawMetadata)
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  const name = path.basename(path.dirname(entry))
  if (parsed.data.name !== name) throw new Error(`metadata name "${parsed.data.name}" must match directory "${name}"`)
  const content = source.slice(match[0].length).trim()
  if (requireContent && !content) throw new Error('Skill Markdown body is empty')
  return { name, description: parsed.data.description, tags: parsed.data.tags ?? [], content }
}

async function readFrontmatter(filePath: string): Promise<string> {
  const handle = await open(filePath, 'r')
  try {
    const chunks: Buffer[] = []
    let size = 0
    while (size < maxFrontmatterBytes) {
      const buffer = Buffer.allocUnsafe(4096)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, size)
      if (!bytesRead) break
      chunks.push(buffer.subarray(0, bytesRead))
      size += bytesRead
      const text = Buffer.concat(chunks).toString('utf8')
      const match = text.match(frontmatterPattern)
      if (match) return `${match[0]}`
      if (text.includes('\n---') && text.split(/\r?\n/).length > 1 && !text.startsWith('---')) break
    }
    throw new Error(size >= maxFrontmatterBytes ? 'YAML frontmatter exceeds 64 KiB' : 'missing YAML frontmatter delimited by ---')
  } finally { await handle.close() }
}

export async function createSkillsPlugin(config: RuntimeConfig) {
  const root = path.resolve(config.skillsDir)
  const entries = new Map<string, { path: string; metadata: SkillMetadata }>()
  const invalid: Array<{ path: string; reason: string }> = []
  const contentCache = new Map<string, SkillDocument>()
  const canonicalRoot = await realpath(root).catch(() => root)
  let directories: Array<{ name: string; isDirectory(): boolean }> = []
  try { directories = await readdir(root, { withFileTypes: true }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') invalid.push({ path: root, reason: `cannot scan skills directory: ${(error as Error).message}` })
  }
  for (const directory of directories.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const skillPath = path.join(root, directory.name, 'SKILL.md')
    try {
      const canonicalFile = await realpath(skillPath)
      const relative = path.relative(canonicalRoot, canonicalFile)
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('SKILL.md resolves outside skills directory')
      const source = await readFrontmatter(skillPath)
      const parsed = parseSkill(source, skillPath, false)
      if (entries.has(parsed.name)) throw new Error(`duplicate Skill name "${parsed.name}"`)
      entries.set(parsed.name, { path: skillPath, metadata: { name: parsed.name, description: parsed.description, tags: parsed.tags } })
    } catch (error) {
      invalid.push({ path: skillPath, reason: (error as Error).message })
    }
  }
  return {
    name: 'skills',
    apply(ctx: Context) {
      ctx.set('skills', {
        list: () => [...entries.values()].map(({ metadata }) => ({ ...metadata, tags: [...metadata.tags] })),
        async load(name: string) {
          const cached = contentCache.get(name)
          if (cached) return { ...cached, tags: [...cached.tags] }
          const entry = entries.get(name)
          if (!entry) throw new Error(`Unknown Skill: ${name}`)
          const info = await stat(entry.path)
          if (info.size > maxSkillBytes) throw new Error(`Skill "${name}" exceeds 256 KiB limit`)
          const source = await readFile(entry.path, 'utf8')
          const document = parseSkill(source, entry.path)
          contentCache.set(name, document)
          return { ...document, tags: [...document.tags] }
        },
      } satisfies SkillService)
      for (const item of invalid) ctx.emit('skills/invalid', item.path, item.reason)
    },
  }
}
