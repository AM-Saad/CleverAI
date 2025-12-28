// shared/utils/user.contract.ts
import { z } from "zod";

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

// User profile schema
export const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string(),
  gender: z.string().nullable(),
  role: z.enum(["USER"]),
  createdAt: z.string().datetime().or(z.date()).or(z.string()),
  updatedAt: z.string().datetime().or(z.date()).or(z.string()),
  deletedAt: z.string().datetime().or(z.date()).or(z.string()).nullable().optional(),
  scheduledDeletionAt: z.string().datetime().or(z.date()).or(z.string()).nullable().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// Update profile DTO
export const UpdateProfileDTO = z.object({
  name: z.preprocess(trim, z.string().min(1, "Name is required")).optional(),
  phone: z.preprocess(trim, z.string().min(10, "Phone must be at least 10 characters")).optional(),
  gender: z.preprocess(trim, z.string()).optional(),
});
export type UpdateProfileDTO = z.infer<typeof UpdateProfileDTO>;

// Update profile response
export const UpdateProfileResponseSchema = z.object({
  success: z.boolean(),
  user: UserProfileSchema,
  message: z.string(),
});
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;

// Delete account DTO
export const DeleteAccountDTO = z.object({
  confirmationText: z.preprocess(
    trim,
    z.string().refine((val) => val === "DELETE", {
      message: "Confirmation text must be 'DELETE'",
    })
  ),
  permanent: z.boolean().default(false),
});
export type DeleteAccountDTO = z.infer<typeof DeleteAccountDTO>;

// Delete account response
export const DeleteAccountResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  permanent: z.boolean(),
  scheduledDeletionAt: z.string().datetime().or(z.date()).or(z.string()).nullable().optional(),
});
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;

// Reactivate account response
export const ReactivateAccountResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: UserProfileSchema,
});
export type ReactivateAccountResponse = z.infer<typeof ReactivateAccountResponseSchema>;

// Change password DTO
export const ChangePasswordDTO = z.object({
  currentPassword: z.preprocess(trim, z.string().min(6, "Current password is required")),
  newPassword: z.preprocess(trim, z.string().min(6, "Password must be at least 6 characters")),
  confirmPassword: z.preprocess(trim, z.string().min(6, "Confirm password is required")),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
export type ChangePasswordDTO = z.infer<typeof ChangePasswordDTO>;

// Change password response
export const ChangePasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;

// User progress schema
export const UserProgressSchema = z.object({
  level: z.number(),
  stage: z.string(),
  xpIntoLevel: z.number(),
  xpForNextLevel: z.number(),
  progressPercent: z.number(),
});
export type UserProgress = z.infer<typeof UserProgressSchema>;
