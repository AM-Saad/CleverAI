// server/api/auth/find.post.ts
import { PrismaClient } from "@prisma/client"
import { z } from "zod"

const prisma = new PrismaClient()

const userSchema = z.object({
  email: z.string().email(),
})

export default defineEventHandler(async (event) => {
  const result = await readValidatedBody(event, (body) =>
    userSchema.safeParse(body),
  )
  if (!result.success) {
    event.respondWith(
      new Response(JSON.stringify(result.error.issues), { status: 422 }),
    )
  }
  try {
    // Extract user data from request body
    const body = await readBody(event)
    const { email } = body
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
      include:{
        subscription: true,
        folders: true,
      }
    })

    if (!existingUser) {
      setResponseStatus(event, 400)
      return {
        message: "User with this email does not exist.",
      }
    }

    return {
      body: existingUser,
      message: "User found successfully.",
    }
  } catch (error) {
    throw new Error("Registration failed")
  }
})
