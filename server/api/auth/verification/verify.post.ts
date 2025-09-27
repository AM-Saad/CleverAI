// server/api/verification/verify.post.ts
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client"
import { verificationCode } from "~/utils/verificationCode.server"
import { ErrorFactory, withErrorHandling, getErrorContextFromEvent } from "../../../utils/standardErrorHandler"

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  return await withErrorHandling(async () => {
    const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)
    const body = await readBody(event)
    const { email, verification } = body

    if (!email || !verification) {
      ErrorFactory.validation("Missing email or verification code", { email, verification }, context)
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      ErrorFactory.notFound("user", context)
    }

    if (
      !user!.register_verification ||
      user!.register_verification !== verification
    ) {
      ErrorFactory.validation("Verification code does not match", { verification }, context)
    }

    await prisma.user.update({
      where: { email },
      data: {
        email_verified: true,
        register_verification: null,
      },
    })

    if (!user!.password) {
      // Create JWT token
      const newVerificationCode = await verificationCode()

      const token = jwt.sign(
        {
          email: user!.email,
          password_verification: newVerificationCode,
        },
        process.env.AUTH_SECRET!,
        {
          expiresIn: "1h",
        },
      )

      await prisma.user.update({
        where: { email },
        data: {
          password_verification: newVerificationCode,
        },
      })

      return {
        message: `Verification successful, you will now be redirected to create a password for your account`,
        body: {
          redirect: `/auth/createPassword?token=${token}`,
        },
      }
    }

    return {
      message: "Verification successful",
      body: {
        redirect: "/auth/signIn",
      },
    }
  }, getErrorContextFromEvent(event as unknown as Record<string, unknown>))
})
