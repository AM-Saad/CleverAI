/**
 * Bundles every icon in `app/assets/icons` into a single SVG sprite at
 * `public/icons.svg`, consumed by `AppIcon` via `<use href="/icons.svg#name">`.
 *
 * Why a sprite rather than inlining the SVGs into the JS bundle:
 *  - One HTTP request for the whole set instead of ~194 lazy chunks.
 *  - It is a static asset, so `inject-sw.cjs` (which globs `**\/*.svg` from the
 *    build output) precaches it with a content revision. The service worker then
 *    serves it from Cache Storage with no network, and only re-downloads when the
 *    sprite's contents actually change — so it survives deploys, which inlining
 *    into a content-hashed JS chunk does not.
 *  - Keeps ~74KB of raw markup out of the entry chunk.
 *
 * Shape markup is copied verbatim from the source SVGs; geometry is never
 * recomputed. Run `generate-icons.ts` first — it validates the sources.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import {
  AI_BADGE_PATH,
  AI_BASE_SCALE,
  AI_VARIANT_BASES,
  aiVariantName,
  compensatedStrokeWidth,
} from './icon-manifest'

const iconsDir = resolve(process.cwd(), 'app/assets/icons')
const spriteFile = resolve(process.cwd(), 'public/icons.svg')
const outputFile = resolve(process.cwd(), 'app/utils/icon-sprite.generated.ts')

/** `--check` fails when the committed sprite is stale, for pre-commit and CI. */
const checkOnly = process.argv.includes('--check')

/**
 * Presentation attributes lifted from each source `<svg>` onto its `<symbol>`.
 * They must live on the symbol: an external `<use>` renders into a shadow tree,
 * so host CSS cannot reach the shapes inside. `stroke="currentColor"` still
 * resolves against the host's inherited `color`, which is how theming works.
 *
 * `stroke-width` is deliberately absent — see SET_STROKE_WIDTH below.
 */
const CARRIED_ATTRS = [
  'fill',
  'stroke',
  'stroke-linecap',
  'stroke-linejoin',
] as const

/**
 * The weight the source SVGs are authored at (and what `sync-lucide-icons`
 * writes, matching upstream Lucide).
 *
 * Symbols at this weight omit `stroke-width` entirely so the value inherits
 * from `--component-icon-stroke-width` on the host — making the set's signature
 * weight a single CSS token that can also vary by size. An icon authored at any
 * other weight has made a deliberate choice, so its value is baked onto the
 * symbol, where a presentation attribute beats the inherited one. `grid.svg`
 * relies on this: its cells collide at anything heavier than 1.25.
 */
const SET_STROKE_WIDTH = '2'

if (!existsSync(iconsDir)) {
  throw new Error(`Icons directory does not exist: ${iconsDir}`)
}

const names = readdirSync(iconsDir)
  .filter((file) => file.endsWith('.svg'))
  .map((file) => basename(file, extname(file)))
  .sort((a, b) => a.localeCompare(b))

/** Parsed source icon, reused for both the plain symbol and any AI variant. */
function readIcon(name: string) {
  const svg = readFileSync(resolve(iconsDir, `${name}.svg`), 'utf8')

  const openTag = svg.match(/<svg\b([^>]*)>/)
  if (!openTag) throw new Error(`${name}.svg: no <svg> element`)

  const inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()
  if (!inner) throw new Error(`${name}.svg: empty`)

  const viewBox = openTag[1].match(/viewBox="([^"]*)"/)?.[1]
  if (!viewBox) throw new Error(`${name}.svg: missing viewBox`)

  const attrs = CARRIED_ATTRS.map((attr) => {
    const value = openTag[1].match(new RegExp(`\\b${attr}="([^"]*)"`))?.[1]
    return value === undefined ? null : `${attr}="${value}"`
  }).filter(Boolean)

  const strokeWidth = openTag[1].match(/\bstroke-width="([^"]*)"/)?.[1]
  if (strokeWidth !== undefined && strokeWidth !== SET_STROKE_WIDTH) {
    attrs.push(`stroke-width="${strokeWidth}"`)
  }

  const indent = (markup: string, pad: string) =>
    markup.split('\n').map((line) => `${pad}${line.trim()}`).join('\n')

  return { viewBox, carried: attrs.join(' '), inner, indent }
}

function plainSymbol(name: string) {
  const { viewBox, carried, inner, indent } = readIcon(name)
  return `  <symbol id="${name}" viewBox="${viewBox}"${carried ? ` ${carried}` : ''}>\n${indent(inner, '    ')}\n  </symbol>`
}

/**
 * Composes `<base>-ai`: the base mark shrunk into the bottom-left, plus the
 * sparkle badge in the corner it vacated. Composition is a uniform transform
 * over untouched geometry — never a rewrite of the base's path data.
 */
function aiVariantSymbol(base: string) {
  const { viewBox, carried, inner, indent } = readIcon(base)
  const s = AI_BASE_SCALE
  return [
    `  <symbol id="${aiVariantName(base)}" viewBox="${viewBox}"${carried ? ` ${carried}` : ''}>`,
    `    <g transform="translate(0,24) scale(${s}) translate(0,-24)" style="stroke-width: ${compensatedStrokeWidth(s)}">`,
    indent(inner, '      '),
    `    </g>`,
    `    <path d="${AI_BADGE_PATH}" />`,
    `  </symbol>`,
  ].join('\n')
}

for (const base of AI_VARIANT_BASES) {
  if (!names.includes(base)) {
    throw new Error(`icon-manifest: AI_VARIANT_BASES references missing icon "${base}.svg"`)
  }
}

const symbols = [
  ...names.map(plainSymbol),
  ...AI_VARIANT_BASES.map(aiVariantSymbol),
]

const sprite = `<svg xmlns="http://www.w3.org/2000/svg">
${symbols.join('\n')}
</svg>
`

const hash = createHash('sha256').update(sprite).digest('hex').slice(0, 8)

const module = `// -----------------------------------------------------------------------------
// This file is auto-generated by scripts/build-icon-sprite.ts
// Do not edit this file manually.
// -----------------------------------------------------------------------------

/** Public URL of the icon sprite. Precached by the service worker. */
export const ICON_SPRITE_URL = '/icons.svg'

/** Content hash of the sprite, for debugging which build a client is running. */
export const ICON_SPRITE_HASH = '${hash}'
`

const spriteStale = !existsSync(spriteFile) || readFileSync(spriteFile, 'utf8') !== sprite
const moduleStale = !existsSync(outputFile) || readFileSync(outputFile, 'utf8') !== module

if (checkOnly) {
  if (spriteStale || moduleStale) {
    console.error(
      'build-icon-sprite: public/icons.svg is out of date with app/assets/icons.\n' +
        'Run: yarn build:icon-sprite',
    )
    process.exit(1)
  }
  console.log(`build-icon-sprite: sprite up to date (${names.length} icons, ${hash})`)
  process.exit(0)
}

if (spriteStale) writeFileSync(spriteFile, sprite)
if (moduleStale) writeFileSync(outputFile, module)

console.log(
  `build-icon-sprite: ${names.length} icons + ${AI_VARIANT_BASES.length} AI variants ` +
    `= ${symbols.length} symbols -> public/icons.svg ` +
    `(${(Buffer.byteLength(sprite) / 1024).toFixed(1)}KB, ${hash})${spriteStale ? '' : ' [unchanged]'}`,
)
