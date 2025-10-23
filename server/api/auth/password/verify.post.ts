// server/api/auth/password/verify.post.ts (migrated)
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
    !user.password_verification ||
    user.password_verification !== parsed.verification
  ) {
    throw Errors.badRequest("Verification code does not match");
  }

  const newCode = await verificationCode();
  const token = jwt.sign(
    { email: user.email, password_verification: newCode },
    process.env.AUTH_SECRET!,
    { expiresIn: "1m" }
  );

  await prisma.user.update({
    where: { email: parsed.email },
    data: { password_verification: newCode },
  });

  return success({ message: "Verification successful", token });
});
