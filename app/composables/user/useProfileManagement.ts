import { useOperation } from "../shared/useOperation";
import type {
  UpdateProfileDTO,
  UpdateProfileResponse,
  DeleteAccountDTO,
  DeleteAccountResponse,
  ReactivateAccountResponse,
  ChangePasswordDTO,
  ChangePasswordResponse,
} from "@@/shared/utils/user.contract";
import type { UserProfile } from "@/services/UserService";

export type { UserProfile };

export function useProfileManagement() {
  const { $api } = useNuxtApp();

  // Update profile operation
  const {
    pending: updatePending,
    error: updateError,
    typedError: updateTypedError,
    data: updateData,
    execute: executeUpdate,
    reset: resetUpdate,
  } = useOperation<UpdateProfileResponse>();

  // Delete account operation
  const {
    pending: deletePending,
    error: deleteError,
    typedError: deleteTypedError,
    data: deleteData,
    execute: executeDelete,
    reset: resetDelete,
  } = useOperation<DeleteAccountResponse>();

  // Reactivate account operation
  const {
    pending: reactivatePending,
    error: reactivateError,
    typedError: reactivateTypedError,
    data: reactivateData,
    execute: executeReactivate,
    reset: resetReactivate,
  } = useOperation<ReactivateAccountResponse>();

  // Change password operation
  const {
    pending: changePasswordPending,
    error: changePasswordError,
    typedError: changePasswordTypedError,
    data: changePasswordData,
    execute: executeChangePassword,
    reset: resetChangePassword,
  } = useOperation<ChangePasswordResponse>();

  // Fetch profile operation
  const {
    pending: fetchProfilePending,
    error: fetchProfileError,
    typedError: fetchProfileTypedError,
    data: fetchProfileData,
    execute: executeFetchProfile,
    reset: resetFetchProfile,
  } = useOperation<UserProfile>();

  /**
   * Fetch user profile
   */
  const fetchProfile = async () => {
    return executeFetchProfile(() => $api.user.fetchProfile());
  };
  const updateProfile = async (data: UpdateProfileDTO) => {
    return executeUpdate(() => $api.user.updateProfile(data));
  };

  /**
   * Delete user account (soft or permanent)
   */
  const deleteAccount = async (data: DeleteAccountDTO) => {
    return executeDelete(() => $api.user.deleteAccount(data));
  };

  /**
   * Reactivate a soft-deleted account
   */
  const reactivateAccount = async () => {
    return executeReactivate(() => $api.user.reactivateAccount());
  };

  /**
   * Change user password
   */
  const changePassword = async (data: ChangePasswordDTO) => {
    return executeChangePassword(() => $api.user.changePassword(data));
  };

  return {
    // Fetch profile
    fetchProfile,
    fetchProfilePending,
    fetchProfileError,
    fetchProfileTypedError,
    fetchProfileData,
    resetFetchProfile,

    // Update profile
    updateProfile,
    updatePending,
    updateError,
    updateTypedError,
    updateData,
    resetUpdate,

    // Delete account
    deleteAccount,
    deletePending,
    deleteError,
    deleteTypedError,
    deleteData,
    resetDelete,

    // Reactivate account
    reactivateAccount,
    reactivatePending,
    reactivateError,
    reactivateTypedError,
    reactivateData,
    resetReactivate,

    // Change password
    changePassword,
    changePasswordPending,
    changePasswordError,
    changePasswordTypedError,
    changePasswordData,
    resetChangePassword,
  };
}
