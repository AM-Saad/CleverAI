<template>
    <div class="space-y-6">
        <UiPanel size="md" variant="surface">
            <template #header>
                <div class="flex items-center gap-2">
                    <UiIcon name="i-lucide-shield-check" class="w-5 h-5" />
                    Security Settings
                </div>
            </template>
            <div class="space-y-4">
                <UiSubtitle size="lg">Password Management</UiSubtitle>
                <UiButton color="primary" variant="soft" class="mt-3" @click="showChangePasswordModal = true">
                    Change Password
                </UiButton>

                <div class="border-t border-muted pt-4 space-y-4">
                    <UiSubtitle size="xl" color="danger" weight="bold">
                        Danger Zone
                    </UiSubtitle>
                    <UiParagraph color="content-secondary">
                        Permanently delete your account and all data
                    </UiParagraph>
                    <UiButton color="error" variant="soft" @click="showDeleteModal = true">
                        Delete Account
                    </UiButton>
                </div>
            </div>
        </UiPanel>

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
            await signOut({ redirect: false });
            window.location.href = "/auth/signin";
        } else {
            // Soft delete - inform user and sign out
            await signOut({ redirect: false });
            window.location.href = "/auth/signin?message=account_scheduled_deletion";
        }
    }
};
</script>
