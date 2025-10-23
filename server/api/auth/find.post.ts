// server/api/auth/find.post.ts (migrated)
import { z } from 'zod'
import { Errors, success } from '@server/utils/error'
import type { User } from '@prisma/client'

const userSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type SafeUser = Omit<User, 'password' | 'register_verification' | 'password_verification'>

export default defineEventHandler(async (event) => {
  const raw = await readBody(event)
  let parsed
  try {
    parsed = userSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest('Invalid email', err.issues.map(i => ({ path: i.path, message: i.message })))
    }
    throw Errors.badRequest('Invalid email')
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: parsed.email },
    include: { subscription: true, folders: true }
  })

  if (!existingUser) {
    throw Errors.notFound('User')
  }

  const { password, register_verification, password_verification, ...rest } = existingUser
  const safe = rest as SafeUser

  return success({ user: safe, message: 'User found successfully.' })
})
