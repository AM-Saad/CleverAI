// server/api/auth/verification/index.post.ts (migrated)
import { z } from 'zod'
import { sendVerificationSchema as emailOnlySchema } from "../../../../shared/auth.schemas";
import { applyLimit, getClientIp, setRateLimitHeaders, type MemCounter } from "../../../utils/llm/rateLimit";

const schema = emailOnlySchema

export default defineEventHandler(async (event) => {
  // Rate limit: per-email and IP for verification sends
  const now = Date.now()
  const windowMs = 60 * 1000
  const emailMap: MemCounter = (globalThis as any).__rl_email_verify__ || new Map()
    ; (globalThis as any).__rl_email_verify__ = emailMap
  const ipMap: MemCounter = (globalThis as any).__rl_ip_verify__ || new Map()
    ; (globalThis as any).__rl_ip_verify__ = ipMap

  const raw = await readBody(event)
  let parsed: z.infer<typeof schema>
  try {
    parsed = schema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest('Invalid email', err.issues.map(i => ({ path: i.path, message: i.message })))
    }
    throw Errors.badRequest('Invalid email')
  }

  const clientIp = getClientIp(event)
  const userRemaining = await applyLimit(`rl:verify:email:${parsed.email}`, 3, emailMap, now, windowMs)
  const ipRemaining = await applyLimit(`rl:verify:ip:${clientIp}`, 10, ipMap, now, windowMs)
  const overallRemaining = Math.min(userRemaining, ipRemaining)
  setRateLimitHeaders(event, overallRemaining, userRemaining, ipRemaining, now)

  const user = await prisma.user.findUnique({ where: { email: parsed.email } })
  if (!user) {
    // Avoid leaking user existence
    const resetSeconds = Number(event.node.res.getHeader('X-RateLimit-Reset') || 60)
    return success({ message: 'If user exists, a verification code has been sent', remainingAttempts: overallRemaining, resetSeconds })
  }

  const code = await verificationCode()
  try {
    await sendEmail(parsed.email, code)
  } catch {
    throw Errors.server('Failed to send verification email')
  }

  await prisma.user.update({
    where: { email: parsed.email },
    data: { register_verification: code, account_verified: false }
  })

  const resetSeconds = Number(event.node.res.getHeader('X-RateLimit-Reset') || 60)
  return success({ message: 'Verification code sent', remainingAttempts: overallRemaining, resetSeconds })
})
