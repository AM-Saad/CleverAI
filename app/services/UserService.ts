// app/services/UserService.ts
import FetchFactory from "./FetchFactory";
import type { Result } from "@/types/Result";
import type {
  UserProfile,
  UpdateProfileDTO,
  UpdateProfileResponse,
  DeleteAccountDTO,
  DeleteAccountResponse,
  ReactivateAccountResponse,
  ChangePasswordDTO,
  ChangePasswordResponse,
  ChangePasswordResponse,
  UserProgress,
  UserProgressSchema,
} from "@@/shared/utils/user.contract";

export class UserService extends FetchFactory {
  private readonly RESOURCE = "/api/user";

  /**
   * Fetch user profile
   */
  async fetchProfile(): Promise<Result<UserProfile>> {
    return this.call<UserProfile>("GET", `${this.RESOURCE}/profile`);
  }

  /**
   * Fetch user progress (level, XP)
   */
  async getProgress(): Promise<Result<UserProgress>> {
    return this.call<UserProgress>(
      "GET",
      `${this.RESOURCE}/progress`,
      undefined,
      {},
      UserProgressSchema
    );
  }

  /**
   * Update user profile
   */
  async updateProfile(
    data: UpdateProfileDTO
  ): Promise<Result<UpdateProfileResponse>> {
    return this.call<UpdateProfileResponse>(
      "PATCH",
      `${this.RESOURCE}/update`,
      data
    );
  }

  /**
   * Delete user account (soft or permanent)
   */
  async deleteAccount(
    data: DeleteAccountDTO
  ): Promise<Result<DeleteAccountResponse>> {
    return this.call<DeleteAccountResponse>(
      "DELETE",
      `${this.RESOURCE}/delete`,
      data
    );
  }

  /**
   * Reactivate a soft-deleted account
   */
  async reactivateAccount(): Promise<Result<ReactivateAccountResponse>> {
    return this.call<ReactivateAccountResponse>(
      "POST",
      `${this.RESOURCE}/reactivate`,
      {}
    );
  }

  /**
   * Change user password
   */
  async changePassword(
    data: ChangePasswordDTO
  ): Promise<Result<ChangePasswordResponse>> {
    return this.call<ChangePasswordResponse>(
      "PATCH",
      `${this.RESOURCE}/change-password`,
      data
    );
  }
}

export default UserService;
