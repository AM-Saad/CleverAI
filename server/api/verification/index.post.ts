// server/api/verification.post.ts
import { sendEmail } from "~/utils/sendGrid.server"
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
    const user = await prisma.users.findUnique({
      where: { email },
    })

    if (!user) {
      setResponseStatus(event, 404)
      return {
        message: "User not found",
      }
    }

    const newVerificationCode = await verificationCode()
    await sendEmail(email, newVerificationCode)

    await prisma.users.update({
      where: { email },
      data: {
        register_verification: newVerificationCode,
        account_verified: false,
      },
    })

    return {
      message: "Verification code has been sent to your email",
    }
  } catch (error) {
    throw new Error("Failed to send verification email")
  }
})
