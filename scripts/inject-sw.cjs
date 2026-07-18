#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const etag = require('etag')
const { injectManifest } = require('workbox-build')

function refreshNitroPublicAssetMetadata(swDest) {
  const nitroManifest = path.resolve(process.cwd(), '.output/server/chunks/nitro/nitro.mjs')
  if (!fs.existsSync(nitroManifest)) {
    throw new Error(`Nitro asset manifest not found: ${nitroManifest}`)
  }

  const bytes = fs.readFileSync(swDest)
  const stat = fs.statSync(swDest)
  const serializedEtag = JSON.stringify(etag(bytes))
  const mtime = stat.mtime.toISOString()
  const lines = fs.readFileSync(nitroManifest, 'utf8').split('\n')
  const entryStart = lines.findIndex((line) => line.includes('"/sw.js": {'))
  if (entryStart < 0) {
    throw new Error('Nitro asset manifest does not contain /sw.js')
  }

  let updatedEtag = false
  let updatedMtime = false
  let updatedSize = false
  for (let index = entryStart + 1; index < Math.min(entryStart + 10, lines.length); index += 1) {
    if (lines[index].includes('"etag":')) {
      lines[index] = `    "etag": ${serializedEtag},`
      updatedEtag = true
    } else if (lines[index].includes('"mtime":')) {
      lines[index] = `    "mtime": ${JSON.stringify(mtime)},`
      updatedMtime = true
    } else if (lines[index].includes('"size":')) {
      lines[index] = `    "size": ${bytes.length},`
      updatedSize = true
    }
  }
  if (!updatedEtag || !updatedMtime || !updatedSize) {
    throw new Error('Could not refresh all /sw.js metadata in Nitro asset manifest')
  }
  fs.writeFileSync(nitroManifest, lines.join('\n'))
  console.log('inject-sw: refreshed Nitro /sw.js metadata')
}

async function run() {
  const swSrc = path.resolve(process.cwd(), 'public/sw.js')
  const swDest = path.resolve(process.cwd(), '.output/public/sw.js')
  const globDirectory = path.resolve(process.cwd(), '.output/public')

  console.log('inject-sw: swSrc=', swSrc)
  console.log('inject-sw: swDest=', swDest)
  console.log('inject-sw: globDirectory=', globDirectory)

  try {
    const result = await injectManifest({
      swSrc,
      swDest,
      globDirectory,
      globPatterns: [
        '**/*.{js,css,html,png,jpg,jpeg,webp,svg,ico,json,webmanifest}'
      ],
      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
    })

    console.log('inject-sw: Success. Generated', result.count, 'files, size', result.size, 'bytes')
    refreshNitroPublicAssetMetadata(swDest)
  } catch (err) {
    console.error('inject-sw: Failed:', err)
    process.exit(1)
  }
}

run()
