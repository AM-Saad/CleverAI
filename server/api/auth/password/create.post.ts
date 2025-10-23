// server/api/auth/password/create.post.ts (migrated)
import bcrypt from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";

const schema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(30, "Password must be 30 or fewer characters"),
  confirmPassword: z
    .string()
    .min(8, "Confirm Password must be at least 8 characters")
    .max(30, "Confirm Password must be 30 or fewer characters"),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid password data",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid password data");
  }

  const authHeader = event.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) {
    throw Errors.unauthorized("Missing authorization token");
  }

  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  if (!decoded || typeof decoded !== "object") {
    throw Errors.unauthorized("Invalid token");
  }
  if (isTokenExpired(decoded)) {
    throw Errors.unauthorized("Token has expired");
  }

  const email = decoded.email as string | undefined;
  if (!email) {
    throw Errors.badRequest("Token missing email");
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw Errors.notFound("User");
  }

  if (decoded.password_verification !== user.password_verification) {
    throw Errors.unauthorized("Invalid verification token");
  }

  if (parsed.password !== parsed.confirmPassword) {
    throw Errors.badRequest("Passwords do not match", [
      { path: ["confirmPassword"], message: "Passwords do not match" },
    ]);
  }

  const hashedPassword = bcrypt.hashSync(parsed.password, 10);
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword, password_verification: null },
  });

  return success({ message: "Password created successfully" });
});
