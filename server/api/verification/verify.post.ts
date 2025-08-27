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
      !user.register_verification ||
      user.register_verification !== verification
    ) {
      setResponseStatus(event, 400)
      return {
        message: "Verification does not match",
      }
    }

    await prisma.users.update({
      where: { email },
      data: {
        email_verified: true,
        register_verification: null,
      },
    })

    if (!user.password) {
      // Create JWT token
      const newVerificationCode = await verificationCode()

      const token = jwt.sign(
        {
          email: user.email,
          password_verification: newVerificationCode,
        },
        process.env.AUTH_SECRET!,
        {
          expiresIn: "1h",
        },
      )

      await prisma.users.update({
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
  } catch (error) {
    throw new Error("Failed to verify authentication response")
  }
})
