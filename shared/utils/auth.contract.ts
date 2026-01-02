// shared/utils/auth.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

// ==========================================
// User Schema (Auth context)
// ==========================================

export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string(),
  gender: z.string().optional(),
  role: z.enum(["USER"]),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
  // Authentication fields
  credentials: z.record(z.string(), z.unknown()).optional(),
  auth_provider: z.string().optional(),
  account_verified: z.boolean(),
  email_verified: z.boolean(),
  register_verification: z.string().optional(),
  password_verification: z.string().optional(),
  passkey_user_id: z.string().optional(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

// ==========================================
// Register DTO
// ==========================================

export const RegisterDTO = z.object({
  name: z.preprocess(trim, z.string().min(1, "Name is required").max(100)),
  email: z.preprocess(
    trim,
    z.string().email("Please enter a valid email address")
  ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(30, "Password must be 30 or fewer characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,30}$/,
      "Password must include uppercase, lowercase, number, and symbol"
    ),
  confirmPassword: z.string(),
  gender: z.preprocess(trim, z.string()).optional(),
  role: z.enum(["USER"]).default("USER"),
  provider: z.string().default("credentials"),
});
export type RegisterDTO = z.infer<typeof RegisterDTO>;

// ==========================================
// Auth Response Types
// ==========================================

export const AuthRegisterResponseSchema = z.object({
  message: z.string(),
  redirect: z.string().optional(),
  needsVerification: z.boolean().optional(),
});
export type AuthRegisterResponse = z.infer<typeof AuthRegisterResponseSchema>;

export const AuthVerificationResponseSchema = z.object({
  message: z.string(),
  redirect: z.string().optional(),
});
export type AuthVerificationResponse = z.infer<
  typeof AuthVerificationResponseSchema
>;

export const AuthForgotPasswordVerifyResponseSchema = z.object({
  message: z.string(),
  token: z.string().optional(),
});
export type AuthForgotPasswordVerifyResponse = z.infer<
  typeof AuthForgotPasswordVerifyResponseSchema
>;

export const AuthCreatePasswordResponseSchema = z.object({
  message: z.string(),
});
export type AuthCreatePasswordResponse = z.infer<
  typeof AuthCreatePasswordResponseSchema
>;

export const AuthFindUserResponseSchema = z.object({
  user: AuthUserSchema.partial(),
  message: z.string(),
});
export type AuthFindUserResponse = z.infer<typeof AuthFindUserResponseSchema>;

export const AuthGenericMessageSchema = z.object({
  message: z.string(),
});
export type AuthGenericMessage = z.infer<typeof AuthGenericMessageSchema>;

export const AuthProfileResponseSchema = z.object({
  success: z.boolean(),
  user: AuthUserSchema,
});
export type AuthProfileResponse = z.infer<typeof AuthProfileResponseSchema>;

// ==========================================
// Verification DTOs
// ==========================================

export const SendVerificationDTO = z.object({
  email: z.preprocess(trim, z.string().email()),
});
export type SendVerificationDTO = z.infer<typeof SendVerificationDTO>;

export const VerifyCodeDTO = z.object({
  email: z.preprocess(trim, z.string().email()),
  verification: z.preprocess(
    trim,
    z.string().min(1, "Verification code is required").max(12)
  ),
});
export type VerifyCodeDTO = z.infer<typeof VerifyCodeDTO>;

export const PasswordCreateDTO = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(30, "Password must be 30 or fewer characters"),
  confirmPassword: z.string(),
});
export type PasswordCreateDTO = z.infer<typeof PasswordCreateDTO>;
