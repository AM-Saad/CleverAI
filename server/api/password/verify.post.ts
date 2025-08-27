// server/api/verification/verify.post.ts
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client"
import { verificationCode } from "~/utils/verificationCode.server"

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, verification } = body

  if (!email || !verification) {
    setResponseStatus(event, 400)
    return {
      message: "Missing email or verification",
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

    if (
      !user.password_verification ||
      user.password_verification !== verification
    ) {
      setResponseStatus(event, 400)
      return {
        message: "Verification does not match",
      }
    }

    const newVerificationCode = await verificationCode()

    const token = jwt.sign(
      {
        email: user.email,
        password_verification: newVerificationCode,
      },
      process.env.AUTH_SECRET!,
      {
        expiresIn: "1m",
      },
    )

    await prisma.users.update({
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
  } catch (error) {
    throw new Error("Failed to verify authentication response")
  }
})
