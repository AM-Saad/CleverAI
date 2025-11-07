// server/api/auth/verification/verify.post.ts (migrated)
import jwt from "jsonwebtoken";
import { z } from "zod";
import { verifyCodeSchema } from "../../../../shared/auth.schemas";

const schema = verifyCodeSchema;

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid verification data",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid verification data");
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (!user) {
    throw Errors.notFound("User");
  }

  if (
    !user.register_verification ||
    user.register_verification !== parsed.verification
  ) {
    throw Errors.badRequest("Verification code does not match");
  }

  await prisma.user.update({
    where: { email: parsed.email },
    data: { email_verified: true, register_verification: null },
  });

  // If user has no password yet -> issue password setup token
  if (!user.password) {
    const newCode = await verificationCode();
    // Align token lifetime with password reset flow (15m)
    const token = jwt.sign(
      { email: user.email, password_verification: newCode, purpose: "password", flow: "first-set" },
      process.env.AUTH_SECRET!,
      { expiresIn: "15m" }
    );
    await prisma.user.update({
      where: { email: parsed.email },
      data: { password_verification: newCode },
    });
    return success({
      message: "Verification successful - set password",
      redirect: `/auth/editPassword?token=${token}&email=${encodeURIComponent(parsed.email)}`,
    });
  }

  return success({
    message: "Verification successful",
    redirect: "/auth/signIn",
  });
});
