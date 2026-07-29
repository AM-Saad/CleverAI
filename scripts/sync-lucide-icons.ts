/**
 * Regenerates every Lucide-derived icon in `app/assets/icons` from the installed
 * `lucide-vue-next` package.
 *
 * Path data is copied **verbatim** from upstream and is never re-serialised.
 * This matters: an earlier conversion pass tried to normalise path syntax and
 * silently destroyed 156 of 161 icons — implicit-coordinate polylines were
 * truncated to their first point (`m6 9 6 6 6-6` became `M 6 9`, so
 * `chevron-down` drew nothing) and straight lines became curves (`M5 12h14`
 * became `M 5 12 Q 12 13 19 12`). Nothing here touches geometry.
 *
 * Run after bumping `lucide-vue-next` to pick up upstream fixes:
 *   yarn sync:lucide-icons
 *
 * Icons listed in CUSTOM are hand-authored and have no upstream equivalent;
 * they are left untouched.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

const iconsDir = resolve(process.cwd(), 'app/assets/icons')
const lucideDir = resolve(process.cwd(), 'node_modules/lucide-vue-next/dist/esm/icons')

/**
 * Local names kept for historical reasons that map onto a differently-named
 * upstream Lucide icon. Prefer the upstream name for new icons.
 */
const ALIASES: Record<string, string> = {
  'alert-circle': 'circle-alert',
  'alert-triangle': 'triangle-alert',
  'check-square': 'square-check-big',
  columns: 'columns-3',
  indent: 'indent-increase',
  'layers-3': 'layers',
  'list-number': 'list-ordered',
  'loader-2': 'loader-circle',
  'more-horizontal': 'ellipsis',
  'more-vertical': 'ellipsis-vertical',
  outdent: 'indent-decrease',
  'rectangle-stack': 'layers',
  'row-spacing': 'rows-3',
}

/** Hand-authored icons with no Lucide equivalent — never overwritten. */
const CUSTOM = new Set([
  'action-items-sketch',
  'color-bucket',
  'color-picker',
  'cursor-arrow-rays',
  'daily-note-sketch',
  'document',
  'duplicate',
  'edit',
  'ellipse',
  'generate',
  'plus-square',
  'reload',
  'security',
  'text-icon',
  'workspaces',
])

type Shape = [string, Record<string, string | number>]

/** Pulls the raw node array out of a compiled `createLucideIcon(...)` module. */
function readUpstream(lucideName: string): Shape[] | null {
  const file = resolve(lucideDir, `${lucideName}.js`)
  if (!existsSync(file)) return null
  const src = readFileSync(file, 'utf8')
  const match = src.match(/createLucideIcon\(\s*"[^"]*",\s*(\[[\s\S]*?\])\s*\);/)
  if (!match) return null
  try {
    return new Function(`return ${match[1]}`)() as Shape[]
  } catch {
    return null
  }
}

function renderSvg(shapes: Shape[]) {
  const body = shapes
    .map(([tag, attrs]) => {
      const rendered = Object.entries(attrs)
        // `key` is a Vue render-list artefact, not SVG.
        .filter(([name]) => name !== 'key')
        .map(([name, value]) => `${name}="${value}"`)
        .join(' ')
      return `  <${tag} ${rendered} />`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
${body}
</svg>
`
}

if (!existsSync(lucideDir)) {
  throw new Error(`lucide-vue-next not found at ${lucideDir} — run an install first`)
}

const names = readdirSync(iconsDir)
  .filter((file) => file.endsWith('.svg'))
  .map((file) => basename(file, extname(file)))
  .sort((a, b) => a.localeCompare(b))

let written = 0
let unchanged = 0
const missing: string[] = []

for (const name of names) {
  if (CUSTOM.has(name)) continue

  const lucideName = ALIASES[name] ?? name
  const shapes = readUpstream(lucideName)
  if (!shapes) {
    missing.push(`${name}${lucideName === name ? '' : ` (-> ${lucideName})`}`)
    continue
  }

  const target = resolve(iconsDir, `${name}.svg`)
  const next = renderSvg(shapes)
  const current = existsSync(target) ? readFileSync(target, 'utf8') : ''
  if (current === next) {
    unchanged += 1
    continue
  }
  writeFileSync(target, next)
  written += 1
}

console.log(
  `sync-lucide-icons: ${written} rewritten, ${unchanged} already in sync, ${CUSTOM.size} custom skipped`,
)

if (missing.length) {
  console.error(
    `\nsync-lucide-icons: no upstream Lucide icon for ${missing.length} name(s):\n  ${missing.join('\n  ')}\n` +
      `Add it to CUSTOM (hand-authored) or to ALIASES (renamed upstream).`,
  )
  process.exit(1)
}
