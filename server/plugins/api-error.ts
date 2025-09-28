// Global error normalization for API routes
// Nitro auto-loads this plugin. We avoid direct import of defineNitroPlugin for type simplicity.
import { normalizeError } from '../utils/error'

export default defineNitroPlugin((app) => {
  app.hooks.hook('error', (err, ctx) => {
    const event = ctx?.event as any
    if (!event) return

    // If response already sent, do nothing
    if (event.node.res.headersSent || event.node.res.writableEnded) return

    const normalized = normalizeError(err)

    try {
      event.node.res.statusCode = normalized.error.statusCode
      event.node.res.setHeader('Content-Type', 'application/json')
      event.node.res.end(JSON.stringify(normalized))
    } catch {
      // swallow
    }
  })
})
