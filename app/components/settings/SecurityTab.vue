<template>
    <div class="space-y-6">
        <ui-card size="lg" variant="default">
            <template #header>
                <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-shield-check" class="w-5 h-5" />
                    Security Settings
                </div>
            </template>
            <div class="space-y-4">
                <UiSubtitle size="lg">Password Management</UiSubtitle>
                <UButton color="primary" variant="outline" class="mt-3" @click="showChangePasswordModal = true">
                    Change Password
                </UButton>

                <div class="border-t border-muted pt-4 space-y-4">
                    <UiSubtitle size="xl" color="danger" weight="bold">
                        Danger Zone
                    </UiSubtitle>
                    <UiParagraph color="muted">
                        Permanently delete your account and all data
                    </UiParagraph>
                    <UButton color="error" variant="outline" @click="showDeleteModal = true">
                        Delete Account
                    </UButton>
                </div>
            </div>
        </ui-card>

        <!-- Modals -->
        <user-change-password-modal :show="showChangePasswordModal" @close="showChangePasswordModal = false"
            @change="handleChangePassword" />

        <user-delete-account-modal :show="showDeleteModal" @close="showDeleteModal = false"
            @confirm="handleDeleteAccount" />
    </div>
</template>

<script setup lang="ts">
import type { ChangePasswordDTO, DeleteAccountDTO } from "@@/shared/utils/user.contract";

const toast = useToast();
const { signOut } = useAuth();

// Modal states
const showChangePasswordModal = ref(false);
const showDeleteModal = ref(false);

// Profile management
const {
    changePassword,
    deleteAccount,
} = useProfileManagement();

// Handle change password
const handleChangePassword = async (data: ChangePasswordDTO) => {
    const result = await changePassword(data);

    if (result) {
        showChangePasswordModal.value = false;
        toast.add({
            title: "Success",
            description: "Password changed successfully",
            color: "success",
        });
    }
};

// Handle delete account
const handleDeleteAccount = async (data: DeleteAccountDTO) => {
    const result = await deleteAccount(data);

    if (result) {
        showDeleteModal.value = false;

        if (data.permanent) {
            // Immediate deletion - sign out
            await signOut({ callbackUrl: "/auth/signIn" });
        } else {
            // Soft delete - inform user and sign out
            await signOut({
                callbackUrl: "/auth/signIn?message=account_scheduled_deletion"
            });
        }
    }
};
</script>
