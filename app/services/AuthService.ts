// app/services/AuthService.ts
import FetchFactory from "./FetchFactory";
import type { Result } from "~/types/Result";
import type {
  AuthUser,
  RegisterDTO,
  AuthRegisterResponse,
  AuthVerificationResponse,
  AuthForgotPasswordVerifyResponse,
  AuthCreatePasswordResponse,
  AuthFindUserResponse,
  AuthGenericMessage,
  AuthProfileResponse,
} from "@@/shared/utils/auth.contract";

class AuthModule extends FetchFactory {
  private RESOURCE = "/api/auth";

  /**
   * Register a new user
   */
  async register(userData: RegisterDTO): Promise<Result<AuthRegisterResponse>> {
    return this.call<AuthRegisterResponse>(
      "POST",
      `${this.RESOURCE}/register`,
      { ...userData, provider: userData.provider || "credentials" }
    );
  }

  /**
   * Register user (alternative method using RESOURCES enum)
   */
  async registerUser(credentials: {
    name?: string;
    email: string;
    password?: string;
    confirmPassword?: string;
    provider: string;
  }): Promise<Result<AuthRegisterResponse>> {
    return this.call<AuthRegisterResponse>(
      "POST",
      `/api/auth/register`,
      credentials
    );
  }

  /**
   * Verify user email
   */
  async verify(email: string): Promise<Result<AuthVerificationResponse>> {
    return this.call<AuthVerificationResponse>(
      "POST",
      `${this.RESOURCE}/verification`,
      { email }
    );
  }

  /**
   * Find user by email
   * Updated: returns { user, message }
   */
  async findUser(email: string): Promise<Result<AuthFindUserResponse>> {
    return this.call<AuthFindUserResponse>("POST", `${this.RESOURCE}/find`, {
      email,
    });
  }

  /**
   * Authenticate user
   */
  async authenticate(credentials: {
    email: string;
    password: string;
  }): Promise<Result<AuthGenericMessage>> {
    return this.call<AuthGenericMessage>(
      "POST",
      `${this.RESOURCE}/authenticate`,
      credentials
    );
  }

  /**
   * Register passkey
   */
  async registerPasskey(email: string): Promise<Result<AuthGenericMessage>> {
    return this.call<AuthGenericMessage>(
      "POST",
      `${this.RESOURCE}/passkey/register`,
      { email }
    );
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<Result<AuthProfileResponse>> {
    return this.call<AuthProfileResponse>("GET", `${this.RESOURCE}/profile`);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    updates: Partial<AuthUser>
  ): Promise<Result<AuthProfileResponse>> {
    return this.call<AuthProfileResponse>(
      "PATCH",
      `${this.RESOURCE}/profile`,
      updates
    );
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(
    email: string
  ): Promise<
    Result<{
      success: boolean;
      message: string;
      remainingAttempts?: number;
      resetSeconds?: number;
      redirect?: string;
    }>
  > {
    return this.call<{
      success: boolean;
      message: string;
      remainingAttempts?: number;
      resetSeconds?: number;
      redirect?: string;
    }>("POST", `${this.RESOURCE}/password/forgot`, { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<Result<{ success: boolean; message: string }>> {
    return this.call<{ success: boolean; message: string }>(
      "POST",
      `${this.RESOURCE}/reset-password`,
      { token, password: newPassword }
    );
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    email: string
  ): Promise<
    Result<
      AuthVerificationResponse & {
        remainingAttempts?: number;
        resetSeconds?: number;
      }
    >
  > {
    return this.call<
      AuthVerificationResponse & {
        remainingAttempts?: number;
        resetSeconds?: number;
      }
    >("POST", `${this.RESOURCE}/verification`, { email });
  }

  /**
   * Verify account with verification code
   */
  async verifyAccount(
    email: string,
    verification: string
  ): Promise<Result<AuthVerificationResponse>> {
    return this.call<AuthVerificationResponse>(
      "POST",
      `${this.RESOURCE}/verification/verify`,
      { email, verification }
    );
  }

  /**
   * Verify forgot password code
   */
  async verifyForgotPassword(
    email: string,
    verification: string
  ): Promise<Result<AuthForgotPasswordVerifyResponse>> {
    return this.call<AuthForgotPasswordVerifyResponse>(
      "POST",
      `${this.RESOURCE}/password/verify`,
      { email, verification }
    );
  }

  /**
   * Create password
   */
  async createPassword(
    token: string,
    password: string,
    confirmPassword: string
  ): Promise<Result<AuthCreatePasswordResponse>> {
    return this.call<AuthCreatePasswordResponse>(
      "POST",
      `${this.RESOURCE}/password/create`,
      { password, confirmPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
}

export default AuthModule;
export { AuthModule as AuthService };
