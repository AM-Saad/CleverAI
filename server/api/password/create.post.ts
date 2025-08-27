// server/api/auth/createPassword.post.ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"
import jwt from "jsonwebtoken"
import { isTokenExpired } from "~/utils/isTokenExpired.server"
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
  const result = await readValidatedBody(event, (body) =>
    userSchema.safeParse(body),
  ) // or `.parse` to directly throw an error
  if (!result.success) {
    event.respondWith(
      new Response(
        JSON.stringify({ message: result.error.issues[0].message }),
        {
          status: 422,
        },
      ),
    )
  }
  try {
    const body = await readBody(event)

    const { password, confirmPassword } = body
    const authHeader = event.headers.get("Authorization")
    const token = authHeader?.split(" ")[1] || null

    if (!authHeader || !token) {
      setResponseStatus(event, 401)
      return {
        message: "Unauthorized - Missing token",
      }
    }

    const decoded = jwt.decode(token) as jwt.JwtPayload
    if (isTokenExpired(decoded as jwt.JwtPayload)) {
      throw createError({
        status: 401,
        statusMessage: "Unauthorized - Token expired",
        message: "Unauthorized - Token expired",
      })
    }
    const email = decoded.email
    const existingUser = await prisma.users.findFirst({
      where: {
        email,
      },
    })

    if (!existingUser) {
      throw createError({
        status: 404,
        statusMessage: "User not found",
        message: "User not found",
      })
    }

    if (decoded.password_verification !== existingUser.password_verification) {
      throw createError({
        status: 401,
        statusMessage: "Unauthorized",
        message: "Unauthorized",
      })
    }

    if (password !== confirmPassword) {
      throw createError({
        status: 400,
        statusMessage: "Passwords do not match",
        message: "Passwords do not match",
      })
    }

    const hashedPassword = bcrypt.hashSync(password, 10)

    const user = await prisma.users.update({
      where: {
        email,
      },
      data: {
        password: hashedPassword,
        password_verification: null,
      },
    })
    return user
  } catch (error) {
    return error
  }
})
