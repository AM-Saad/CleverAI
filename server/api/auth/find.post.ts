// server/api/auth/find.post.ts
import { PrismaClient } from "@prisma/client"
import { z } from "zod"
import { ErrorFactory, withErrorHandling, getErrorContextFromEvent } from "../../utils/standardErrorHandler"
import { validateBody } from "../../utils/validationHandler"

const prisma = new PrismaClient()

const userSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

export default defineEventHandler(async (event) => {
  const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)

  return await withErrorHandling(async () => {
    // Read and validate request body using standardized validation
    const rawBody = await readBody(event)
    const { email } = await validateBody({ body: rawBody }, userSchema)

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
      include: {
        subscription: true,
        folders: true,
      }
    })

    if (!existingUser) {
      ErrorFactory.notFound("user", context)
    }

    return {
      body: existingUser,
      message: "User found successfully.",
    }
  }, context)
})
