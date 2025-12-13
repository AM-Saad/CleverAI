/**
 * Middleware to fix Vercel's pre-parsed body issue for auth callbacks.
 *
 * On Vercel's serverless environment:
 * 1. Vercel's runtime pre-parses form-urlencoded POST bodies
 * 2. The body arrives at Nitro as `[Object: null prototype]` (already parsed)
 * 3. `@sidebase/nuxt-auth` calls `readBody()` expecting raw Buffer/string
 * 4. Nitro's `readBody` tries to call `Buffer.from()` on the object
 * 5. This causes ERR_INVALID_ARG_TYPE error
 *
 * This middleware converts the pre-parsed object back to URL-encoded string.
 */
import { defineEventHandler, getRequestURL } from "h3";

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const path = url.pathname;

  // Only process auth callback POST requests
  if (path.includes("/api/auth/callback") && event.method === "POST") {
    const rawBody = (event.node.req as any).body;

    // Check if body is already parsed as an object (Vercel pre-parsing)
    if (
      rawBody &&
      typeof rawBody === "object" &&
      !(rawBody instanceof Buffer)
    ) {
      // Convert the parsed object back to URL-encoded string
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(rawBody)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }

      // Replace with string that readBody() can handle
      const bodyString = params.toString();
      (event as any)._requestBody = bodyString;
      (event.node.req as any)._body = bodyString;
      (event.node.req as any).body = undefined; // Clear pre-parsed body
    }
  }
});
