// server/api/auth/register.post.ts (migrated)
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(30, "Password must be 30 or fewer characters"),
  confirmPassword: z.string().min(8).max(30),
  provider: z.string().optional().default("credentials"),
  gender: z.string().optional(),
  role: z.enum(["USER"]).default("USER"),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest(
        "Invalid registration data",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid registration data");
  }

  const {
    email,
    password,
    confirmPassword,
    gender,
    role,
    provider,
    name,
  } = parsed;

  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) {
    // Normalize messaging to avoid leaking provider/verif status
    throw Errors.badRequest(
      "An account with this email may already exist. Please sign in or verify your email."
    );
  }

  if (provider === "credentials" && password !== confirmPassword) {
    throw Errors.badRequest("Passwords do not match", [
      { path: ["confirmPassword"], message: "Passwords do not match" },
    ]);
  }

  const hashedPassword =
    provider === "credentials" ? bcrypt.hashSync(password, 10) : "";
  const code = provider === "credentials" ? await verificationCode() : null;

  try {
    if (provider === "credentials" && code) {
      try {
        await sendEmail(email, code);
      } catch {
        throw Errors.methodNotAllowed("Failed to send verification email");
      }
    }
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        passkey_user_id: null,
        auth_provider: provider,
        register_verification: code,
        account_verified: provider === "credentials" ? false : true,
        email_verified: provider !== "credentials",
        gender,
        role,
      },
    });

    // if (provider === "credentials" && code) {
    //   try {
    //     await sendEmail(email, code);
    //   } catch {
    //     throw Errors.server("Failed to send verification email");
    //   }
    // }

    return success({
      message: "Account created successfully",
      needsVerification: provider === "credentials",
      redirect:
        provider === "credentials"
          ? `/auth/verifyAccount?email=${encodeURIComponent(email)}&code=1`
          : "/auth/signIn",
    });
  } catch (err) {
    throw Errors.server("Failed to register user", err);
  }

});
