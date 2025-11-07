// server/api/auth/password/verify.post.ts (migrated)
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
    !user.password_verification ||
    user.password_verification !== parsed.verification
  ) {
    throw Errors.badRequest("Verification code is incorrect");
  }

  const newCode = await verificationCode();
  // Issue short-lived token (now 15m) used for password creation
  const token = jwt.sign(
    { email: user.email, password_verification: newCode, purpose: "password", flow: "reset" },
    process.env.AUTH_SECRET!,
    { expiresIn: "15m" }
  );

  await prisma.user.update({
    where: { email: parsed.email },
    data: { password_verification: newCode },
  });

  return success({ message: "Verification successful", token });
});
