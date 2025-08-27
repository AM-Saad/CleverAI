import { PrismaClient } from "@prisma/client"
import { verifyAuthenticationResponse } from "@simplewebauthn/server" // Replace with your actual library
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types"

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const session = event.context.session
  const email = session?.email
  const config = useRuntimeConfig()

  if (!email) {
    event.res.statusCode = 400
    return "No email found in session"
  }

  const user = await prisma.users.findUnique({
    where: { email },
  })

  if (!user) {
    return {
      status: 404,
      body: {
        message: "User not found",
      },
    }
  }

  const credential = await prisma.publickeycreds.findFirst({
    where: {
      id: body.id,
      passkey_user_id: user.id,
    },
  })
  if (!credential) {
    return {
      status: 404,
      body: {
        message: "Credential not found",
      },
    }
  }

  const public_key_uint8Array = new Uint8Array(credential.public_key!)
  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: session?.challenge,
      expectedOrigin: config.public.APP_BASE_URL, // Replace with your origin
      expectedRPID: "localhost", // Replace with your domain
      authenticator: {
        ...credential,
        credentialPublicKey: public_key_uint8Array,
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransportFuture[],
      },
    })

    if (verification.verified) {
      return { verified: true }
    } else {
      event.res.statusCode = 400
      return "Verification failed"
    }
  } catch (error) {
    console.error(error)
    return {
      status: 500,
      body: {
        message: "Internal server error",
      },
    }
  }
})
