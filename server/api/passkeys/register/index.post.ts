import { PrismaClient } from "@prisma/client"
import { generateRegistrationOptions } from "@simplewebauthn/server" // Replace with your actual library
const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body

  const session = event.context.session
  try {
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

    const options = await generateRegistrationOptions({
      rpName: "Recwide",
      rpID: "localhost", // Change this to your domain
      userID: Buffer.from(user.id),
      userName: email,
      userDisplayName: user.name,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        authenticatorAttachment: "platform",
        requireResidentKey: false,
        userVerification: "preferred",
      },
      timeout: 60000,
    })
    if (session) {
      console.log("session", session)
      session.challenge = options.challenge
      session.email = email
    }
    console.log("session after", session)
    return {
      status: 200,
      body: options,
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
