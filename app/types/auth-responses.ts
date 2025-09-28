// Centralized auth response interfaces reflecting unified success envelope data shapes
export interface AuthRegisterResponse {
  message: string
  redirect?: string
  needsVerification?: boolean
}

export interface AuthVerificationResponse {
  message: string
  redirect?: string
}

export interface AuthForgotPasswordVerifyResponse {
  message: string
  token?: string
}

export interface AuthCreatePasswordResponse {
  message: string
}

export interface AuthFindUserResponse<TUser = unknown> {
  user: TUser
  message: string
}

export interface AuthPasskeyOptionsResponse<TOptions = unknown> {
  options: TOptions
}

export interface AuthGenericMessage {
  message: string
}
