import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"

const prisma = new PrismaClient()

const userSchema = z.object({
  email: z.string().email(),
})

export default defineEventHandler(async (event) => {
  const result = await readValidatedBody(event, (body) =>
    userSchema.safeParse(body),
  ) // or `.parse` to directly throw an error
  if (!result.success) {
    event.respondWith(
      new Response(JSON.stringify(result.error.issues), { status: 422 }),
    )
  }
  try {
    // Extract user data from request body
    const body = await readBody(event)

    const { email } = body
    // Here, you should hash the password before saving it to the database

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    })

    if (!existingUser) {
      return {
        status: 400,
        body: {
          message: "Credentials are invalid!. Please try again.",
        },
      }
    }

    return {
      status: 200,
      body: {
        message: "Registration successful",
        user: existingUser,
      },
    }
  } catch (error) {
    console.error("Registration error:", error)
    // Handle registration error, such as returning an error response
    throw new Error("Registration failed")
  }
})
