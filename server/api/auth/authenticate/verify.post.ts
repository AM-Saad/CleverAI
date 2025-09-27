import { PrismaClient } from "@prisma/client"
import { verifyAuthenticationResponse } from "@simplewebauthn/server" // Replace with your actual library
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types"
import { ErrorFactory, withErrorHandling, getErrorContextFromEvent } from "../../../utils/standardErrorHandler"

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  return await withErrorHandling(async () => {
    const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)
    const body = await readBody(event)
    const session = event.context.session
    const email = session?.email
    const config = useRuntimeConfig()

    if (!email) {
      ErrorFactory.unauthorized("No email found in session", context)
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      ErrorFactory.notFound("user", context)
    }

    const credential = await prisma.publickeycreds.findFirst({
      where: {
        id: body.id,
        passkey_user_id: user!.id,
      },
    })

    if (!credential) {
      ErrorFactory.notFound("credential", context)
    }

    const public_key_uint8Array = new Uint8Array(credential!.public_key!)

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: session?.challenge,
      expectedOrigin: config.public.APP_BASE_URL, // Replace with your origin
      expectedRPID: "localhost", // Replace with your domain
      credential: {
        id: credential!.id,
        publicKey: public_key_uint8Array,
        counter: credential!.counter,
        transports: credential!.transports as AuthenticatorTransportFuture[],
      },
    })

    if (verification.verified) {
      return { verified: true }
    } else {
      ErrorFactory.validation("Authentication verification failed", { verification }, context)
    }
  }, getErrorContextFromEvent(event as unknown as Record<string, unknown>))
})
