import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { AI_VARIANT_BASES, aiVariantName } from './icon-manifest'

const iconsDir = resolve(process.cwd(), 'app/assets/icons')
const outputDir = resolve(process.cwd(), 'app/utils')
const outputFile = resolve(outputDir, 'icons.generated.ts')

/** `--check` validates without writing, for pre-commit and CI. */
const checkOnly = process.argv.includes('--check')

const SHAPE_ELEMENTS = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse'] as const

/** Argument count per SVG path command, keyed by its lowercase form. */
const PATH_ARITY: Record<string, number> = {
  m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0,
}

const COMMAND = /^[MmLlHhVvCcSsQqTtAaZz]$/
const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g

/**
 * Validates a path `d` attribute.
 *
 * These rules exist because a path-rewriting pass once corrupted 156 of 161
 * icons without tripping any gate in the build: `chevron-down` was reduced from
 * `m6 9 6 6 6-6` to `M 6 9` (a single point, rendering nothing) and `check` to
 * `M 20 6 L 15 NaN`. Browsers drop malformed paths silently, `v-html` meant Vue
 * never parsed them, and neither `nuxt build` nor the design gates read path
 * data — so the only detector was a human looking at the screen.
 */
function validatePathData(d: string): string | null {
  const tokens = d.match(TOKEN)
  if (!tokens?.length) return 'contains no path commands'
  if (!/^[Mm]$/.test(tokens[0])) return `must begin with a moveto, found "${tokens[0]}"`

  let index = 0
  let command: string | null = null
  /** True when at least one command actually renders geometry. */
  let draws = false

  while (index < tokens.length) {
    let implicitRepeat = true
    if (COMMAND.test(tokens[index])) {
      command = tokens[index]
      index += 1
      implicitRepeat = false
    }
    if (!command) return `numeric token "${tokens[index]}" before any command`

    const key = command.toLowerCase()
    const arity = PATH_ARITY[key]
    if (arity === undefined) return `unknown command "${command}"`

    for (let offset = 0; offset < arity; offset += 1) {
      const value = tokens[index + offset]
      if (value === undefined) {
        return `command "${command}" expects ${arity} argument(s), found ${offset}`
      }
      if (COMMAND.test(value)) {
        return `command "${command}" expects ${arity} argument(s), found ${offset} before "${value}"`
      }
      if (!Number.isFinite(Number(value))) return `non-finite argument "${value}"`
    }
    index += arity

    // A bare `M`/`Z` paints nothing; an implicit repeat after a moveto is a
    // lineto, which does. This is the rule that catches truncated polylines.
    if (key !== 'z' && (key !== 'm' || implicitRepeat)) draws = true
  }

  if (!draws) return 'only moves the pen — renders nothing'
  return null
}

function validateIcon(name: string, svg: string): string[] {
  const problems: string[] = []

  const nonFinite = svg.match(/\b(NaN|Infinity|-Infinity)\b/g)
  if (nonFinite) problems.push(`contains ${[...new Set(nonFinite)].join(', ')}`)

  if (!/viewBox="0 0 24 24"/.test(svg)) {
    problems.push('missing viewBox="0 0 24 24"')
  }

  const shapePattern = new RegExp(`<(${SHAPE_ELEMENTS.join('|')})\\b`, 'g')
  if (!shapePattern.test(svg)) problems.push('contains no shape elements')

  for (const [, d] of svg.matchAll(/\bd="([^"]*)"/g)) {
    const problem = validatePathData(d)
    if (problem) problems.push(`path ${problem} — d="${d.slice(0, 72)}${d.length > 72 ? '…' : ''}"`)
  }

  return problems.map((problem) => `  ${name}.svg: ${problem}`)
}

function toPascalCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^(.)/, (_, char: string) => char.toUpperCase())
    .replace(/\s/g, '')
}

function assertIconsDirExists() {
  console.log(`Checking icons directory: ${iconsDir}`)
  if (!existsSync(iconsDir)) {
    throw new Error(`Icons directory does not exist: ${iconsDir}`)
  }
}

function ensureOutputDirExists() {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }
}

assertIconsDirExists()
ensureOutputDirExists()

const iconNames = readdirSync(iconsDir)
  .filter((file) => file.endsWith('.svg'))
  .map((file) => basename(file, extname(file)))
  .sort((a, b) => a.localeCompare(b))

const failures = iconNames.flatMap((name) =>
  validateIcon(name, readFileSync(resolve(iconsDir, `${name}.svg`), 'utf8')),
)

for (const base of AI_VARIANT_BASES) {
  if (!iconNames.includes(base)) {
    failures.push(`  icon-manifest: AI_VARIANT_BASES references missing icon "${base}.svg"`)
  }
}

if (failures.length) {
  console.error(
    `generate-icons: ${failures.length} invalid icon(s) in app/assets/icons:\n${failures.join('\n')}\n\n` +
      `Fix the source SVG. For Lucide-derived icons run: yarn sync:lucide-icons`,
  )
  process.exit(1)
}

console.log(`generate-icons: validated ${iconNames.length} icons`)

if (checkOnly) {
  process.exit(0)
}

// AI variants are composed into the sprite rather than authored as files, but
// they are real icon names and must type-check at call sites.
const registryNames = [...iconNames, ...AI_VARIANT_BASES.map(aiVariantName)].sort((a, b) =>
  a.localeCompare(b),
)

const iconArray = registryNames.map((name) => `  '${name}',`).join('\n')

const iconObject = registryNames
  .map((name) => `  ${toPascalCase(name)}: '${name}',`)
  .join('\n')

const content = `// -----------------------------------------------------------------------------
// This file is auto-generated by scripts/generate-icons.ts
// Do not edit this file manually.
// -----------------------------------------------------------------------------

export const ICON_NAMES = [
${iconArray}
] as const

export type IconName = typeof ICON_NAMES[number]

export const IconName = {
${iconObject}
} as const

export type IconNameKey = keyof typeof IconName
`

writeFileSync(outputFile, content)

console.log(`Generated ${iconNames.length} icon name${iconNames.length === 1 ? '' : 's'}.`)