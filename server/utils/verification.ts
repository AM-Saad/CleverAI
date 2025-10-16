import { prisma } from '~~/server/prisma/utils'
import { Errors } from '~~/server/utils/error'

export async function requireUserByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw Errors.notFound('User')
  return user
}

export async function assertRegisterCode(user: { register_verification: string | null }, code: string) {
  if (!user.register_verification || user.register_verification !== code) {
    throw Errors.badRequest('Verification code does not match')
  }
}

export async function assertPasswordCode(user: { password_verification: string | null }, code: string) {
  if (!user.password_verification || user.password_verification !== code) {
    throw Errors.badRequest('Verification code does not match')
  }
}
