// server/api/auth/password/forgot.post.ts (migrated)
import { z } from "zod";
import { sendVerificationSchema as emailOnlySchema } from "../../../../shared/auth.schemas";
import { applyLimit, getClientIp, setRateLimitHeaders, type MemCounter } from "../../../utils/llm/rateLimit";

const schema = emailOnlySchema;

export default defineEventHandler(async (event) => {
  // Rate limit: per-email and per-IP (window 60s)
  const now = Date.now();
  const windowMs = 60 * 1000;
  const emailMap: MemCounter = (globalThis as any).__rl_email_pw__ || new Map();
  (globalThis as any).__rl_email_pw__ = emailMap;
  const ipMap: MemCounter = (globalThis as any).__rl_ip_pw__ || new Map();
  (globalThis as any).__rl_ip_pw__ = ipMap;

  const raw = await readBody(event);
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid email",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid email");
  }

  // Apply server-side rate limit before doing any work
  const clientIp = getClientIp(event);
  const userRemaining = await applyLimit(`rl:pw-forgot:email:${parsed.email}`, 3, emailMap, now, windowMs);
  const ipRemaining = await applyLimit(`rl:pw-forgot:ip:${clientIp}`, 10, ipMap, now, windowMs);
  const overallRemaining = Math.min(userRemaining, ipRemaining);
  setRateLimitHeaders(event, overallRemaining, userRemaining, ipRemaining, now);

  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  const resetSecondsHeader = Number(event.node.res.getHeader('X-RateLimit-Reset') || 60)
  if (!user) {
    // Normalize to avoid enumeration
    return success({ message: "If that email exists, a reset code has been sent", redirect: "/auth/editPassword", remainingAttempts: overallRemaining, resetSeconds: resetSecondsHeader });
  }
  if (!user.email_verified) {
    // Also normalize
    return success({ message: "If that email exists, a reset code has been sent", redirect: "/auth/editPassword", remainingAttempts: overallRemaining, resetSeconds: resetSecondsHeader });
  }

  const code = await verificationCode();
  try {
    await sendPasswordResetEmail(parsed.email, code);
  } catch {
    throw Errors.server("Failed to send verification email");
  }

  await prisma.user.update({
    where: { email: parsed.email },
    data: { password_verification: code },
  });

  return success({
    message: "Password reset code sent",
    redirect: "/auth/editPassword",
    remainingAttempts: overallRemaining,
    resetSeconds: resetSecondsHeader
  });
});
