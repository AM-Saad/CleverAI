// app/services/AuthService.ts
import FetchFactory from './FetchFactory'
import type {
  AuthRegisterResponse,
  AuthVerificationResponse,
  AuthForgotPasswordVerifyResponse,
  AuthCreatePasswordResponse,
  AuthFindUserResponse,
  AuthGenericMessage
} from '~/types/auth-responses'
import type { Result } from '~/types/Result'

export interface IUser {
  id: string
  name: string
  email?: string
  password: string
  phone: string
  gender?: string
  role: 'USER'
  createdAt: string
  updatedAt: string
  // Authentication fields
  credentials?: Record<string, unknown>
  auth_provider?: string
  account_verified: boolean
  email_verified: boolean
  register_verification?: string
  password_verification?: string
  passkey_user_id?: string
}

export interface IRegisterRequest {
  name: string
  email: string
  password: string
  phone: string
  gender?: string
  role?: 'USER'
  provider?: string
}

// Replaced inline response interfaces with centralized auth response types

class AuthModule extends FetchFactory {
  private RESOURCE = '/api/auth'

  /**
   * Register a new user
   */
  async register(userData: IRegisterRequest): Promise<Result<AuthRegisterResponse>> {
    return this.call<AuthRegisterResponse>(
      'POST',
      `${this.RESOURCE}/register`,
      { ...userData, provider: userData.provider || 'credentials' }
    )
  }

  /**
   * Register user (alternative method using RESOURCES enum)
   */
  async registerUser(credentials: { name?: string; email: string; password?: string; confirmPassword?: string; provider: string }): Promise<Result<AuthRegisterResponse>> {
    return this.call<AuthRegisterResponse>('POST', `/api/auth/register`, credentials)
  }

  /**
   * Verify user email
   */
  async verify(email: string): Promise<Result<AuthVerificationResponse>> {
    return this.call<AuthVerificationResponse>(
      'POST',
      `${this.RESOURCE}/verification`,
      { email }
    )
  }

  /**
   * Find user by email
   * Updated: returns { user, message }
   */
  async findUser(email: string): Promise<Result<AuthFindUserResponse<Partial<IUser>>>> {
    return this.call<AuthFindUserResponse<Partial<IUser>>>(
      'POST',
      `${this.RESOURCE}/find`,
      { email }
    )
  }

  /**
   * Authenticate user
   */
  async authenticate(credentials: { email: string; password: string }): Promise<Result<AuthGenericMessage>> {
    return this.call<AuthGenericMessage>(
      'POST',
      `${this.RESOURCE}/authenticate`,
      credentials
    )
  }

  /**
   * Register passkey
   */
  async registerPasskey(email: string): Promise<Result<AuthGenericMessage>> {
    return this.call<AuthGenericMessage>(
      'POST',
      `${this.RESOURCE}/passkey/register`,
      { email }
    )
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<Result<{ success: boolean; user: IUser }>> {
    return this.call<{ success: boolean; user: IUser }>(
      'GET',
      `${this.RESOURCE}/profile`
    )
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<IUser>): Promise<Result<{ success: boolean; user: IUser }>> {
    return this.call<{ success: boolean; user: IUser }>(
      'PATCH',
      `${this.RESOURCE}/profile`,
      updates
    )
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<Result<{ success: boolean; message: string }>> {
    return this.call<{ success: boolean; message: string }>(
      'POST',
      `${this.RESOURCE}/password/forgot`,
      { email }
    )
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<Result<{ success: boolean; message: string }>> {
    return this.call<{ success: boolean; message: string }>(
      'POST',
      `${this.RESOURCE}/reset-password`,
      { token, password: newPassword }
    )
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string): Promise<Result<AuthVerificationResponse>> {
    return this.call<AuthVerificationResponse>(
      'POST',
      `${this.RESOURCE}/verification`,
      { email }
    )
  }

  /**
   * Verify account with verification code
   */
  async verifyAccount(email: string, verification: string): Promise<Result<AuthVerificationResponse>> {
    return this.call<AuthVerificationResponse>(
      'POST',
      `${this.RESOURCE}/verification/verify`,
      { email, verification }
    )
  }

  /**
   * Verify forgot password code
   */
  async verifyForgotPassword(email: string, verification: string): Promise<Result<AuthForgotPasswordVerifyResponse>> {
    return this.call<AuthForgotPasswordVerifyResponse>(
      'POST',
      `${this.RESOURCE}/password/verify`,
      { email, verification }
    )
  }

  /**
   * Create password
   */
  async createPassword(token: string, password: string, confirmPassword: string): Promise<Result<AuthCreatePasswordResponse>> {
    return this.call<AuthCreatePasswordResponse>(
      'POST',
      '/api/auth/password/create',
      { password, confirmPassword },
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
  }
}

export default AuthModule
export { AuthModule as AuthService }
