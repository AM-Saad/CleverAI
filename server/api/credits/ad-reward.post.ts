import { readBody } from "h3";
import { createHmac } from "node:crypto";
import { rewardAdCredit } from "../../modules/subscription/application/rewardAdCredit";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  const body = await readBody(event)
  // AppLixir sends: userId, sessionToken, signature
  const { userId, sessionToken, signature } = body

  const applixirSecret = process.env.APPLIXIR_SECRET;
  if (!applixirSecret) {
    throw createError({ statusCode: 500, message: "AppLixir secret is not configured." });
  }

  // Verify AppLixir's server-to-server HMAC
  const expected = createHmac("sha256", applixirSecret)
    .update(`${userId}:${sessionToken}`)
    .digest("hex")

  if (signature !== expected) {
    throw createError({ statusCode: 403, message: 'Invalid ad callback' })
  }

  await rewardAdCredit({ prisma, userId, sessionToken });
  return { ok: true }
})
