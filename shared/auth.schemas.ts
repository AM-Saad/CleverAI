// shared/auth.schemas.ts
// Centralized Zod schemas for auth flows (email, verification code, password complexity)
import { z } from 'zod'

export const emailSchema = z.string().email('Please enter a valid email address')
export const verificationCodeSchema = z.string().min(1, 'Verification code is required').max(12, 'Code too long')
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(30, 'Password must be 30 or fewer characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,30}$/,'Password must include uppercase, lowercase, number, and symbol')

export const confirmPasswordSchema = passwordSchema

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema,
  provider: z.string().optional().default('credentials'),
  gender: z.string().optional(),
  phone: z.string().min(1, 'Phone is required'),
  role: z.enum(['USER']).default('USER')
})

export const sendVerificationSchema = z.object({ email: emailSchema })
export const verifyCodeSchema = z.object({ email: emailSchema, verification: verificationCodeSchema })
export const passwordResetRequestSchema = z.object({ email: emailSchema })
export const passwordVerifySchema = verifyCodeSchema
export const passwordCreateSchema = z.object({ password: passwordSchema, confirmPassword: passwordSchema })

export type RegisterSchema = z.infer<typeof registerSchema>
export type VerifyCodeSchema = z.infer<typeof verifyCodeSchema>
export type PasswordCreateSchema = z.infer<typeof passwordCreateSchema>
