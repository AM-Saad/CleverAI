// server/api/verification.post.ts
import { sendEmail } from "~/utils/resend.server"
import { verificationCode } from "~/utils/verificationCode.server"
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
export default defineEventHandler(async (event) => {
  const body = await readBody(event) // Get request body

  const { email } = body

  if (!email) {
    setResponseStatus(event, 400)
    return {
      message: "Missing email",
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      setResponseStatus(event, 404)
      return {
        message: "User not found",
      }
    }

    if (!user.email_verified) {
      setResponseStatus(event, 400)
      return {
        message: `This email is not verified. Please verify your email first by clicking <a class="font-bold" href="/auth/verifyAccount?email=${email}">here</a>`,
      }
    }

    const newVerificationCode = await verificationCode()
    await sendEmail(email, newVerificationCode)

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
  } catch (error) {
    console.error('Password reset error:', error)
    throw new Error("Failed to send verification email")
  }
})
