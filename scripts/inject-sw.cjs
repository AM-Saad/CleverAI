#!/usr/bin/env node
const path = require('node:path')
const { injectManifest } = require('workbox-build')

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
  } catch (err) {
    console.error('inject-sw: Failed:', err)
    process.exit(1)
  }
}

run()
