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
      !user!.password_verification ||
      user!.password_verification !== verification
    ) {
      ErrorFactory.validation("Verification code does not match", { verification }, context)
    }

    const newVerificationCode = await verificationCode()

    const token = jwt.sign(
      {
        email: user!.email,
        password_verification: newVerificationCode,
      },
      process.env.AUTH_SECRET!,
      {
        expiresIn: "1m",
      },
    )

    await prisma.user.update({
      where: { email },
      data: {
        password_verification: newVerificationCode,
      },
    })

    return {
      message: "Verification successful",
      body: {
        token,
      },
    }
  }, getErrorContextFromEvent(event as unknown as Record<string, unknown>))
})
