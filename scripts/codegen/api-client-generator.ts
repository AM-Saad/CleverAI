/*
 * Simple API client generator for Nitro server routes.
 * Scans server/api recursively, infers method + path from filenames, and emits typed wrappers.
 * First pass; extend with AST/zod detection later.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

// Configuration
const API_DIR = path.resolve('server/api')
const OUTPUT_FILE = path.resolve('app/lib/api.generated.ts')
const IGNORE_PATTERNS = [/templates\/email/, /debug\//]

// Supported HTTP method suffixes (filename pattern: name.<verb>.ts)
const METHOD_SUFFIXES = ['get','post','put','patch','delete','options','head'] as const
type MethodSuffix = typeof METHOD_SUFFIXES[number]

// Convert file path to route: folders + dynamic segments
function fileToRoute(file: string) {
  // Using let for potential future adjustments
  // eslint-disable-next-line prefer-const
  let rel = path.relative(API_DIR, file).replace(/\\/g, '/')
  if (!rel.endsWith('.ts')) return { route: '/api/invalid', method: 'GET' }
  const withoutExt = rel.slice(0, -3)
  const parts = withoutExt.split('/')
  let last = parts.pop() as string
  let method: string | undefined
  const lastDot = last.lastIndexOf('.')
  if (lastDot !== -1) {
    const maybe = last.slice(lastDot + 1) as MethodSuffix
    if (METHOD_SUFFIXES.includes(maybe)) {
      method = maybe.toUpperCase()
      last = last.slice(0, lastDot)
    }
  }
  parts.push(last)
  const segments = parts
  const routeSegments = segments.map((seg, idx) => {
    if (seg === 'index' && idx === segments.length - 1) return ''
    if (/^\[\.\.\.].+\]$/.test(seg)) return ':' + seg.slice(4, -1) + '*'
    if (/^\[.+\]$/.test(seg)) return ':' + seg.slice(1, -1)
    return seg
  })
  let route = '/' + routeSegments.filter(Boolean).join('/')
  route = '/api' + route
  return { route, method }
}

function toFunctionName(route: string, method?: string) {
  const segments = route.replace(/^\/api\//, '').split('/').filter(Boolean)
  const pascal = segments.map(s => {
    if (s.startsWith(':')) s = s.slice(1)
    return s.replace(/\W+/g, ' ') // replace non-word for safety
      .split(' ').filter(Boolean)
      .map(x => x.charAt(0).toUpperCase() + x.slice(1))
      .join('')
  }).join('') || 'Root'
  return (method || 'GET').toLowerCase() + pascal
}

async function collectTsFiles(dir: string, acc: string[] = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      await collectTsFiles(full, acc)
    } else if (ent.isFile() && full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      acc.push(full)
    }
  }
  return acc
}

async function run() {
  const files = await collectTsFiles(API_DIR)
  const filtered = files
    .filter(f => !f.endsWith('.generated.ts'))
    .filter(f => !IGNORE_PATTERNS.some(r => r.test(f)))

  const entries: Array<{ file: string; route: string; method: string; responseSchema?: string; requestSchema?: string }> = []
  for (const file of filtered) {
    const { route, method } = fileToRoute(path.resolve(file))
    // Skip if no explicit method AND file exports a default event handler with unknown verb (treat as GET)
    const httpMethod = method || 'GET'
    // Naive schema detection: look for exported identifiers ending with ResponseSchema / RequestSchema / RequestBodySchema
  let source = ''
  try { source = await fs.readFile(file, 'utf8') } catch { /* ignore read errors */ }
    const responseMatch = source.match(/export\s+(?:const|let|var|function|class)?\s*(\w+ResponseSchema)\b/)
      || source.match(/(\w+ResponseSchema)\.parse\(/)
    const requestMatch = source.match(/export\s+(?:const|let|var)\s*(\w+(?:RequestSchema|RequestBodySchema))\b/) || source.match(/(\w+(?:RequestSchema|RequestBodySchema))\.parse\(/)
    entries.push({ file, route, method: httpMethod, responseSchema: responseMatch?.[1], requestSchema: requestMatch?.[1] })
  }

  // Sort for stable output
  entries.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method))

  // Basic header
  let out = `/* AUTO-GENERATED FILE. DO NOT EDIT. */\n` +
    `/* Generated: ${new Date().toISOString()} */\n` +
    `import FetchFactory from '../services/FetchFactory'\n` +
    `import type { z } from 'zod'\n` +
    `// Each function returns unwrapped data. Validators are auto-wired when detectable.\n\n`

  // Collect unique schema import paths by scanning for '~/shared/' style imports used in endpoint files
  // Simple heuristic: if schema name detected, re-import from original file path (relative from project root)

  for (const e of entries) {
    const fnName = toFunctionName(e.route, e.method)
    // Identify dynamic params from :param segments
    const dynMatches = [...e.route.matchAll(/:(\w+)(\*)?/g)]
    const dynDecls = dynMatches.map(m => `${m[1]}: ${m[2] ? 'string[]' : 'string'}`)
    const paramsType = dynDecls.length ? `{ ${dynDecls.join('; ')} }` : 'void'
  const pathExpr = '`' + e.route.replace(/:(\w+)(\*)?/g, (_m, p1, star) => {
      return star ? '${params.' + p1 + '.join("/")}' : '${params.' + p1 + '}'
    }) + '`'

    const doc = `/**\n * ${e.method} ${e.route}\n * Source: ${e.file}\n */`
    const hasBody = ['POST','PUT','PATCH','DELETE'].includes(e.method)
    const bodyType = e.requestSchema ? `z.infer<typeof ${e.requestSchema}>` : 'object'
    const respType = e.responseSchema ? `z.infer<typeof ${e.responseSchema}>` : 'any'
    const bodyParam = hasBody ? `body${e.requestSchema ? '' : '?'}: ${hasBody ? bodyType : 'never'}` : ''
    const bodyArg = hasBody ? ', body' : ''
    // Skip validator for now to avoid import issues
    const validatorArg = '' // e.responseSchema ? `, {}, ${e.responseSchema}` : ''
    // Add import for schemas if present and not yet imported (import from the endpoint file path itself)
    if (e.responseSchema || e.requestSchema) {
      // TODO: Improve schema import detection to find actual import source
      // For now, skip auto-imports to avoid path resolution issues
      // const relImport = path.relative(path.dirname(OUTPUT_FILE), e.file).replace(/\\/g,'/').replace(/\.ts$/, '')
      // const existingImportRegex = new RegExp(`import .* from './${relImport}'`)
      // if (!existingImportRegex.test(out)) {
      //   const names = [e.responseSchema, e.requestSchema].filter(Boolean).join(', ')
      //   out += `import { ${names} } from '${relImport.startsWith('.') ? relImport : './' + relImport}'\n`
      // }
    }
    out += `${doc}\nexport async function ${fnName}(ff: FetchFactory, params: ${paramsType}${bodyParam ? ', ' + bodyParam : ''}) {\n  const url = ${paramsType === 'void' ? `'${e.route}'` : pathExpr}\n  return ff.call<${respType}>('${e.method}', url${hasBody ? bodyArg : ''}${validatorArg})\n}\n\n`
  }

  // Hash current output if file exists to avoid needless writes
  let existing = ''
  try { existing = await fs.readFile(OUTPUT_FILE, 'utf8') } catch { /* no existing file */ }
  const normalize = (s: string) => s.replace(/Generated: .*\n/, '')
  if (normalize(existing) === normalize(out)) {
    console.log('No API changes detected; generation skipped')
    return
  }
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
  await fs.writeFile(OUTPUT_FILE, out, 'utf8')
  console.log(`Generated ${entries.length} endpoints -> ${OUTPUT_FILE}`)
}

run().catch(err => { console.error(err); process.exit(1) })
