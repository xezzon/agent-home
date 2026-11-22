/**
 * Entry-local skill root provider for the home-repo layout.
 *
 * `@deepseek-ai/dsh-skill-filesystem` derives the project root from the nearest
 * `.git` ancestor. A home-repo entry (`agent-home/coding`, `agent-home/review`)
 * is not a git root, so its `.agents/skills` bundle is never scanned and the
 * entry's skills are invisible even though they are valid.
 *
 * This provider adds the session working directory's own skill roots as
 * project-level candidates. It deliberately does not walk above `cwd`: when a
 * session changes into a cloned repository, that repository's `.git` root is
 * the project root and the default provider owns its skills.
 *
 * A cwd that is itself a git root is skipped, because the default provider
 * already scans exactly that directory pair.
 */

import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'

export const name = 'skill-cwd'
export const inject = ['skills']

const PROVIDER = 'cwd-filesystem'
/**
 * Lower rank wins. The enclosing git root keeps its `project-dsh` 100 and
 * `project-agents` 200 ranks, so entry-local copies outrank them on ties while
 * still losing to nothing else. User roots (400/500) stay below both.
 */
const CWD_DSH_RANK = 90
const CWD_AGENTS_RANK = 140
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function apply(ctx) {
  let provider
  ctx.skills.registerProvider((control) => {
    provider = new CwdSkillProvider(ctx, control)
    return provider
  })
  // Invalidate the catalog when a tool writes inside a root this provider
  // listed, so a skill created or edited mid-session appears without a restart.
  ctx.on('fs/observed', (target) => {
    if (typeof target?.displayPath === 'string') provider?.observe(target.displayPath)
  })
}

class CwdSkillProvider {
  name = PROVIDER

  constructor(ctx, control) {
    this.ctx = ctx
    this.control = control
    this.roots = new Set()
  }

  async list({ cwd, signal }) {
    signal?.throwIfAborted()
    if (cwd === undefined) return []
    // A git-root cwd is the default provider's project root; adding it again
    // would only create duplicate candidates.
    if (await pathExists(join(cwd, '.git'))) return []

    const candidates = []
    for (const root of [
      { path: join(cwd, '.dsh/skills'), source: 'project-dsh', rank: CWD_DSH_RANK },
      { path: join(cwd, '.agents/skills'), source: 'project-agents', rank: CWD_AGENTS_RANK },
    ]) {
      signal?.throwIfAborted()
      this.roots.add(root.path)
      candidates.push(...await discoverRoot(root, this.ctx))
    }
    return candidates
  }

  async get(candidate, { signal }) {
    signal?.throwIfAborted()
    const locator = candidate.locator
    if (locator === undefined || typeof locator.path !== 'string') return undefined
    const raw = await readText(locator.path, signal)
    if (raw === undefined) return undefined
    const document = splitFrontmatter(raw)
    if (document === undefined) return undefined
    return {
      name: candidate.name,
      description: candidate.description,
      ...candidate.whenToUse !== undefined ? { whenToUse: candidate.whenToUse } : {},
      invocation: candidate.invocation,
      source: candidate.source,
      provider: PROVIDER,
      resourceBase: { kind: 'directory', path: locator.directory },
      path: candidate.path,
      content: document.body.trim(),
    }
  }

  observe(path) {
    for (const root of this.roots) {
      if (isInside(root, path)) {
        this.control.invalidate()
        return
      }
    }
  }
}

async function discoverRoot(root, ctx) {
  let entries
  try {
    entries = await readdir(root.path, { withFileTypes: true, encoding: 'utf8' })
  } catch (error) {
    if (isAbsent(error)) return []
    ctx.logger?.warn(`skill-cwd root "${root.path}" skipped: ${String(error)}`)
    return []
  }

  const skills = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = join(root.path, entry.name)
    let kind = entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : undefined
    if (kind === undefined && entry.isSymbolicLink()) kind = await linkKind(entryPath)
    const locator = kind === 'directory'
      ? { path: join(entryPath, 'SKILL.md'), directory: entryPath }
      : kind === 'file' && entry.name.endsWith('.md')
        ? { path: entryPath, directory: root.path }
        : undefined
    if (locator === undefined) continue

    const raw = await readText(locator.path, undefined)
    if (raw === undefined) continue
    const document = splitFrontmatter(raw)
    if (document === undefined) {
      ctx.logger?.warn(`skill-cwd file ${locator.path} ignored: missing YAML frontmatter`)
      continue
    }
    const parsed = parseSkillFrontmatter(document.data)
    if (parsed === undefined) {
      ctx.logger?.warn(`skill-cwd file ${locator.path} ignored: invalid name, description or invocation frontmatter`)
      continue
    }
    let realPath
    try {
      realPath = await realpath(locator.path)
    } catch {
      continue
    }
    skills.push({
      name: parsed.name,
      description: parsed.description,
      ...parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {},
      invocation: parsed.invocation,
      provider: PROVIDER,
      source: root.source,
      rank: root.rank,
      locator,
      path: realPath,
      resourceBase: { kind: 'directory', path: locator.directory },
    })
  }
  return skills
}

function parseSkillFrontmatter(data) {
  const name = stringField(data, 'name')
  const description = stringField(data, 'description')
  if (name === undefined || description === undefined || !SKILL_NAME.test(name)) return undefined

  const disableModelInvocation = booleanField(data, 'disable-model-invocation')
  const userInvocable = booleanField(data, 'user-invocable')
  // A present-but-invalid boolean parses to `null`; refuse the skill instead of
  // guessing, mirroring the default provider. Absent fields keep their defaults.
  if (disableModelInvocation === null || userInvocable === null) return undefined

  const whenToUse = stringField(data, 'whenToUse')
  return {
    name,
    description,
    ...whenToUse !== undefined ? { whenToUse } : {},
    invocation: {
      modelInvocable: disableModelInvocation !== true,
      userInvocable: userInvocable !== false,
    },
  }
}

function stringField(data, key) {
  const value = data[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

/** `undefined` when absent, `null` when present but not a YAML boolean. */
function booleanField(data, key) {
  const value = data[key]
  if (value === undefined) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true' || lower === 'yes' || lower === 'on') return true
    if (lower === 'false' || lower === 'no' || lower === 'off') return false
  }
  return null
}

async function linkKind(path) {
  try {
    const info = await stat(path)
    if (info.isDirectory()) return 'directory'
    if (info.isFile()) return 'file'
  } catch {
    // A dangling link is not a skill entry.
  }
  return undefined
}

async function readText(path, signal) {
  try {
    return await readFile(path, { encoding: 'utf8', signal })
  } catch (error) {
    if (isAbsent(error)) return undefined
    throw error
  }
}

function splitFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) return undefined
  const end = text.indexOf('\n---', 4)
  if (end === -1) return undefined
  if (text.slice(end + 1, end + 4) !== '---') return undefined
  const after = end + 4
  if (after < text.length && text[after] !== '\n') return undefined
  const body = text.slice(after)
  return {
    data: parseYamlSubset(text.slice(4, end)),
    body: body.startsWith('\n') ? body.slice(1) : body,
  }
}

/**
 * Parse the flat scalar frontmatter DSH skills use. Values may be plain,
 * single-quoted, double-quoted (JSON escapes), or `|` / `>` block scalars.
 * Nested mappings such as `metadata:` are ignored.
 */
function parseYamlSubset(header) {
  const data = {}
  const lines = header.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim().length === 0 || line.trimStart().startsWith('#')) continue
    if (/^\s/.test(line)) continue
    const match = /^([A-Za-z0-9_-]+):(?:[ \t]*(.*))?$/.exec(line)
    if (match === null) continue
    const key = match[1]
    const inline = match[2] ?? ''
    if (/^[|>][+-]?$/.test(inline.trim())) {
      const fold = inline.trim().startsWith('>')
      const collected = []
      while (index + 1 < lines.length) {
        const next = lines[index + 1]
        if (next.trim().length === 0) {
          collected.push('')
          index += 1
          continue
        }
        if (!/^\s/.test(next)) break
        collected.push(next.replace(/^\s+/, ''))
        index += 1
      }
      const text = fold ? foldLines(collected) : collected.join('\n')
      data[key] = text.replace(/\n+$/, '')
      continue
    }
    data[key] = parseScalar(inline)
  }
  return data
}

function parseScalar(raw) {
  const value = raw.trim()
  if (value.length === 0) return undefined
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value)
    } catch {
      return value.replace(/^"|"$/g, '')
    }
  }
  if (value.startsWith("'")) {
    const inner = value.slice(1, value.endsWith("'") ? -1 : undefined)
    return inner.replaceAll("''", "'")
  }
  const comment = value.indexOf(' #')
  return (comment === -1 ? value : value.slice(0, comment)).trim()
}

function foldLines(lines) {
  return lines.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ')
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function isAbsent(error) {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function isInside(root, path) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}
