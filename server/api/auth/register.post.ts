// server/api/auth/register.post.ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { sendEmail } from "~/utils/resend.server"
import { verificationCode } from "~/utils/verificationCode.server"
import { ErrorFactory, withErrorHandling, getErrorContextFromEvent } from "../../utils/standardErrorHandler"
import { validateBody } from "../../utils/validationHandler"

const prisma = new PrismaClient()

const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8, { message: "Password Must be 8 or more characters long" })
    .max(30, { message: "Password Must be 30 or less characters long" }),
  confirmPassword: z
    .string()
    .min(8, { message: "Password Must be 8 or more characters long" })
    .max(30, {
      message: "Confirm Password Must be 30 or less characters long",
    }),
  provider: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().min(1, { message: "Phone is required" }),
  role: z.enum(["USER"]).default("USER"),
})

export default defineEventHandler(async (event) => {
  const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)
  return withErrorHandling(async () => {
    // Read and validate request body using standardized validation
    const rawBody = await readBody(event)
    const body = await validateBody({ body: rawBody }, userSchema)

    const { email, password, confirmPassword, phone, gender, role, provider } = body

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    })

    if (existingUser) {
      const existingUserProvider = existingUser.auth_provider
      if (
        (existingUserProvider === "credentials" && existingUser.password) ||
        (existingUserProvider === "google" && existingUser.email_verified)
      ) {
        ErrorFactory.validation(
          `User already exists, if you forgot your password, you can reset it by clicking <a class='text-blue-500 underline font-semibold' href='/auth/editPassword'>here</a>`,
          { email, provider: existingUserProvider },
          context
        )
      }

      if (
        existingUserProvider != "credentials" &&
        !existingUser.email_verified
      ) {
        ErrorFactory.validation(
          `User was already registered with another provider ( e.g. Google )
          <br /> please use the same provider or you can verify your email address by clicking <a class='text-blue-500 underline font-semibold' href='/auth/verifyAccount?email=${email}'>here</a>`,
          { email, provider: existingUserProvider },
          context
        )
      }
    }

    if (provider === "credentials" && password !== confirmPassword) {
      ErrorFactory.validation("Passwords do not match", { field: "confirmPassword" }, context)
    }

    const hashedPassword =
      provider === "credentials" ? bcrypt.hashSync(password, 10) : null

    // Generate verification code for credentials users
    let newVerificationCode: null | string = null
    if (provider === "credentials") {
      newVerificationCode = await verificationCode()
    }

    // Create a new user in the database
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword || '', // Use empty string for non-credentials users
        phone: phone || '', // Ensure phone is provided
        passkey_user_id: null,
        auth_provider: provider,
        register_verification: newVerificationCode,
        account_verified: provider === "credentials" ? false : true,
        email_verified: provider !== "credentials", // Google users are email verified
        gender,
        role,
      },
    })

    // Send verification email for credentials users
    if (provider === "credentials" && newVerificationCode) {
      try {
        await sendEmail(email, newVerificationCode)
      } catch (emailError) {
        ErrorFactory.externalService("Email", emailError, {
          ...context,
          metadata: { ...context.metadata, service: "email" }
        })
      }
    }

    return {
      message: `Account created successfully, and verification code has been sent to your email ${newVerificationCode}. You will be redirected to verify your account in: `,
      body: {
        redirect: `/auth/verifyAccount?email=${email}&&code=sent`,
      },
    }
  }, context)
})
