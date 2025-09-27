import { PrismaClient } from "@prisma/client"
import { generateAuthenticationOptions } from "@simplewebauthn/server"
import type {
  AuthenticatorTransportFuture,
  Base64URLString,
} from "@simplewebauthn/types"
import { ErrorFactory, withErrorHandling, getErrorContextFromEvent } from "../../../utils/standardErrorHandler"
import { validateBody } from "../../../utils/validationHandler"
import { z } from "zod"

const prisma = new PrismaClient()

const authenticateSchema = z.object({
  email: z.string().email("Please enter a valid email address")
})

export default defineEventHandler(async (event) => {
  const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)

  return await withErrorHandling(async () => {
    // Read and validate request body using standardized validation
    const rawBody = await readBody(event)
    const { email } = await validateBody({ body: rawBody }, authenticateSchema)
    const session = event.context.session

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      ErrorFactory.notFound("user", context)
    }

    const userPasskeys = await prisma.publickeycreds.findMany({
      where: { passkey_user_id: user!.id },
    })

    const options = await generateAuthenticationOptions({
      rpID: "localhost",
      allowCredentials: userPasskeys.map((passkey) => ({
        id: passkey.id as Base64URLString,
        transports: [] as AuthenticatorTransportFuture[],
      })),
    })

    if (session) {
      session.challenge = options.challenge
      session.email = email
    }

    return {
      status: 200,
      body: options,
    }
  }, context)
})
