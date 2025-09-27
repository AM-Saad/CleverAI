// server/api/verification.post.ts
import { sendEmail } from "~/utils/resend.server"
import { verificationCode } from "~/utils/verificationCode.server"
import { PrismaClient } from "@prisma/client"
import { ErrorFactory, withErrorHandling, getErrorContextFromEvent } from "../../../utils/standardErrorHandler"
import { validateBody } from "../../../utils/validationHandler"
import { z } from "zod"

const prisma = new PrismaClient()

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address")
})

export default defineEventHandler(async (event) => {
  const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)

  return await withErrorHandling(async () => {
    // Read and validate request body using standardized validation
    const rawBody = await readBody(event)
    const { email } = await validateBody({ body: rawBody }, forgotPasswordSchema)

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      ErrorFactory.notFound("user", context)
    }

    if (!user!.email_verified) {
      ErrorFactory.validation(
        `This email is not verified. Please verify your email first by clicking <a class="font-bold" href="/auth/verifyAccount?email=${email}">here</a>`,
        { email, email_verified: user!.email_verified },
        context
      )
    }

    const newVerificationCode = await verificationCode()

    try {
      await sendEmail(email, newVerificationCode)
    } catch (emailError) {
      ErrorFactory.externalService("Email", emailError, {
        ...context,
        metadata: { ...context.metadata, service: "email" }
      })
    }

    await prisma.user.update({
      where: { email },
      data: {
        password_verification: newVerificationCode,
      },
    })

    return {
      message: "Verification code has been sent to your email",
      body: {
        redirect: "/api/password/forgot",
      },
    }
  }, context)
})
