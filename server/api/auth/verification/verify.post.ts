// server/api/auth/verification/verify.post.ts (migrated)
import jwt from "jsonwebtoken";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  verification: z.string().min(1, "Verification code is required"),
});

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
    const token = jwt.sign(
      { email: user.email, password_verification: newCode },
      process.env.AUTH_SECRET!,
      { expiresIn: "1h" }
    );
    await prisma.user.update({
      where: { email: parsed.email },
      data: { password_verification: newCode },
    });
    return success({
      message: "Verification successful - set password",
      redirect: `/auth/createPassword?token=${token}`,
    });
  }

  return success({
    message: "Verification successful",
    redirect: "/auth/signIn",
  });
});
