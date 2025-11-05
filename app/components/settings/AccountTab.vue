<template>
    <div class="space-y-6 block min-h-full">
        <ui-card size="lg" variant="default">

            <template #header>
                <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-user" class="w-5 h-5" />
                    Account Information
                </div>
                <!-- <u-button size="md" variant="outline" color="primary" @click="showUpdateModal = true">
                    Update Profile
                </u-button> -->
            </template>

            <template #default>

                <ui-loader v-if="fetchProfilePending" :is-fetching="fetchProfilePending"
                    label="Loading Account Information..." />

                <div v-else-if="profile" class="flex flex-col gap-4">
                    <UiLabel>
                        Name: {{ profile.name }}
                    </UiLabel>

                    <UiLabel>
                        Email: {{ profile.email }}
                    </UiLabel>

                    <UiLabel>
                        Phone: {{ profile.phone || 'Not provided' }}
                    </UiLabel>

                    <UiLabel>
                        Gender: {{ profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) :
                            'Not specified' }}
                    </UiLabel>

                    <UiLabel>
                        {{ formatDate(new Date(profile.createdAt)) }}
                    </UiLabel>
                </div>

                <div v-else class="text-center py-8 text-gray-500">
                    Failed to load profile data
                </div>
            </template>

        </ui-card>

        <!-- Update Profile Modal -->
        <user-update-profile-modal v-if="profile" :show="showUpdateModal" :current-profile="{
            name: profile.name,
            phone: profile.phone,
            gender: profile.gender || ''
        }" @close="showUpdateModal = false" @update="handleUpdateProfile" />
    </div>
</template>

<script setup lang="ts">
import type { UpdateProfileDTO } from "@@/shared/utils/user.contract";
import type { UserProfile } from "~/composables/user/useProfileManagement";

const { status } = useAuth();
const toast = useToast();
const showUpdateModal = ref(false);
const profile = ref<UserProfile | null>(null);

const emit = defineEmits<{
    (event: "refresh"): void;
}>();

// Profile management
const {
    updateProfile,
    fetchProfile,
    fetchProfilePending,
    fetchProfileData,
} = useProfileManagement();




// Utility function
const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(date);
};

// Handle update profile
const handleUpdateProfile = async (updates: UpdateProfileDTO) => {
    const result = await updateProfile(updates);

    if (result) {
        showUpdateModal.value = false;
        // Refresh profile data
        await loadProfile();
        emit("refresh");
        toast.add({
            title: "Success",
            description: "Profile updated successfully",
            color: "success",
        });
    }
};

// Load profile data
const loadProfile = async () => {
    const result = await fetchProfile();
    if (result) {
        profile.value = result;
    }
};

onMounted(async () => {
    await loadProfile();
});
</script>
