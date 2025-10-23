// server/api/auth/password/forgot.post.ts (migrated)
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default defineEventHandler(async (event) => {
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

  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (!user) {
    throw Errors.notFound("User");
  }
  if (!user.email_verified) {
    throw Errors.badRequest("Email not verified");
  }

  const code = await verificationCode();
  try {
    await sendEmail(parsed.email, code);
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
  });
});
