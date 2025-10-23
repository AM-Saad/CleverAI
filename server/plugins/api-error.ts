// Global error normalization for API routes
// Simple: convert any error to consistent JSON format

export default defineNitroPlugin((app) => {
  app.hooks.hook("error", (err, ctx) => {
    const event = ctx?.event;
    if (!event) return;

    // If response already sent, do nothing
    if (event.node.res.headersSent || event.node.res.writableEnded) return;

    // Always normalize to consistent format
    const normalized = normalizeError(err);

    try {
      event.node.res.statusCode = normalized.error.statusCode;
      event.node.res.setHeader("Content-Type", "application/json");
      event.node.res.end(JSON.stringify(normalized));
    } catch {
      // swallow
    }
  });
});
