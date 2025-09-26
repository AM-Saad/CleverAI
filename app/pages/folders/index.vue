<template>
    <div>
        <UiTitle tag="h1">Folders</UiTitle>
        <div v-if="loading" class="text-gray-500 my-xl">
            <div class="flex items-center gap-4">
                <USkeleton class="h-12 w-12 rounded-full" />

                <div class="grid gap-2">
                    <USkeleton class="h-4 w-[250px]" />
                    <USkeleton class="h-4 w-[200px]" />
                </div>
            </div>
        </div>
        <shared-error-message v-if="error" :error="error.message" />
        <div class="mt-4">
            <div v-if="!loading && !folders?.length" class="text-gray-500">
                No folders found.
            </div>
            <ul v-if="folders && folders?.length > 0" class="space-y-4">
                <li v-for="folder in folders" :key="folder.id">
                    <UiCard hover="glow">

                        <NuxtLink :to="`/folders/${folder.id}`">
                            <div class="mb-2 flex items-center">
                                <icon name="ic:round-folder-open" class="inline-block mr-2 text-primary" />

                                <UiSubtitle>{{ folder.title }}</UiSubtitle>
                            </div>
                            <UiParagraph v-if="folder.description" class="">
                                {{ folder.description }}
                            </UiParagraph>
                            <div v-else class="">
                                No description available.
                            </div>
                        </NuxtLink>
                    </UiCard>
                </li>
            </ul>
        </div>
        <modals-create-folder-form :show="show" @cancel="show = false" />
        <div class="mt-4">

            <UButton @click="show = true">Create Folder</UButton>
        </div>
    </div>
</template>

<script setup lang="ts">
// Define page meta for authentication
definePageMeta({
    middleware: 'role-auth', // Use the role-auth middleware
})

const show = ref(false);

const { folders, loading, error } = useFolders()
// Remove automatic notification registration - let users choose
// const { registerNotification } = useNotifications()

// onMounted(() => {
//     registerNotification();
// })
</script>

<style scoped>
/* Add any custom styles here */
</style>
