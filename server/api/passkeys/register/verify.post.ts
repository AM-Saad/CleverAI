import { PrismaClient } from "@prisma/client"
import { verifyRegistrationResponse } from "@simplewebauthn/server" // Replace with your actual library
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const session = event.context.session
  const email = session?.email
  const expectedChallenge = session?.challenge
  const response = await readBody(event)
  const config = useRuntimeConfig()

  console.log("session", session)
  if (!email || !expectedChallenge) {
    return {
      status: 400,
      body: {
        message: "No email or challenge found in session",
      },
    }
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

  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: config.public.APP_BASE_URL,
      expectedRPID: "localhost",
      requireUserVerification: false,
    })

    if (!verified || !registrationInfo) {
      event.res.statusCode = 400
      return "Verification failed"
    }
    //  const { credentialPublicKey, credentialID } = registrationInfo
    const buffer = Buffer.from(registrationInfo.credentialPublicKey)
    await prisma.publickeycreds.create({
      data: {
        public_key: buffer,
        transports: response.response.transports,
        passkey_user_id: user.id,
        backed_up: registrationInfo!.credentialBackedUp,
        credentialID: registrationInfo.credentialID,
        counter: 0,
      },
    })

    //  await prisma.users.update({
    //    where: { email },
    //    // data: { has_registered: true },
    //    data: { passkey_user_id: user.id },
    //  })

    return { verified: true }
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
