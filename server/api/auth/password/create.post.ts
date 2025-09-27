// server/api/auth/createPassword.post.ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"
import jwt from "jsonwebtoken"
import { isTokenExpired } from "~/utils/isTokenExpired.server"
import { ErrorFactory, withErrorHandling, getErrorContextFromEvent } from "../../../utils/standardErrorHandler"

const prisma = new PrismaClient()

const userSchema = z.object({
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
})

export default defineEventHandler(async (event) => {
  return await withErrorHandling(async () => {
    const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)

    // Validate request body
    const result = await readValidatedBody(event, (body) =>
      userSchema.safeParse(body),
    )

    if (!result.success) {
      ErrorFactory.validation("Invalid password data", result.error.issues, context)
    }

    const body = await readBody(event)
    const { password, confirmPassword } = body
    const authHeader = event.headers.get("Authorization")
    const token = authHeader?.split(" ")[1] || null

    if (!authHeader || !token) {
      ErrorFactory.unauthorized("Missing authorization token", context)
    }

    const decoded = jwt.decode(token!) as jwt.JwtPayload
    if (isTokenExpired(decoded as jwt.JwtPayload)) {
      ErrorFactory.unauthorized("Token has expired", context)
    }

    const email = decoded.email
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    })

    if (!existingUser) {
      ErrorFactory.notFound("user", context)
    }

    if (decoded.password_verification !== existingUser!.password_verification) {
      ErrorFactory.unauthorized("Invalid verification token", context)
    }

    if (password !== confirmPassword) {
      ErrorFactory.validation("Passwords do not match", { field: "confirmPassword" }, context)
    }

    const hashedPassword = bcrypt.hashSync(password, 10)

    const user = await prisma.user.update({
      where: {
        email,
      },
      data: {
        password: hashedPassword,
        password_verification: null,
      },
    })

    return user
  }, getErrorContextFromEvent(event as unknown as Record<string, unknown>))
})
