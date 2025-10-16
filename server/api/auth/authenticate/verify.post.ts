import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types'
import { prisma } from '~~/server/prisma/utils'
import { Errors, success } from '~~/server/utils/error'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const session = event.context.session
  const email = session?.email as string | undefined
  if (!email) {
    throw Errors.unauthorized('No email in session')
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw Errors.notFound('User')
  }

  const credential = await prisma.publickeycreds.findFirst({ where: { id: body.id, passkey_user_id: user.id } })
  if (!credential) {
    throw Errors.notFound('Credential')
  }

  const config = useRuntimeConfig()
  const rpID: string = typeof config.public.RPID === 'string' && config.public.RPID.length > 0 ? config.public.RPID : 'localhost'
  const expectedOrigin = config.public.APP_BASE_URL

  const public_key_uint8Array = new Uint8Array(credential.public_key!)

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: session?.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    credential: {
      id: credential.id,
      publicKey: public_key_uint8Array,
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransportFuture[]
    }
  })

  if (!verification.verified) {
    throw Errors.badRequest('Authentication verification failed')
  }

  return success({ verified: true })
})
