// server/api/credits/ad-reward.post.ts
import { CreditTxType } from '@prisma/client'
import { createHmac } from 'crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  // AppLixir sends: userId, sessionToken, signature
  const { userId, sessionToken, signature } = body

  // Verify AppLixir's server-to-server HMAC
  const expected = createHmac('sha256', process.env.APPLIXIR_SECRET!)
    .update(`${userId}:${sessionToken}`)
    .digest('hex')

  if (signature !== expected) {
    throw createError({ statusCode: 403, message: 'Invalid ad callback' })
  }

  // Idempotency: check sessionToken not already used
  const alreadyRewarded = await prisma.creditTransaction.findFirst({
    where: { metadata: { path: ['adSessionToken'], equals: sessionToken } }
  })
  if (alreadyRewarded) return { ok: true } // silently deduplicate

  await grantCredits(userId, 1, CreditTxType.AD_REWARD, { adSessionToken: sessionToken })
  return { ok: true }
})