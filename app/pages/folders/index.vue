<template>
    <div>
        <h1 class="text-2xl font-bold ">Folders</h1>
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
        <div class="mt-6">
            <div v-if="!loading && !folders?.length" class="text-gray-500">
                No folders found.
            </div>
            <ul v-if="folders && folders?.length > 0" class="space-y-4">
                <li v-for="folder in folders" :key="folder.id"
                    class="p-2  rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-foreground transition-colors">
                    <NuxtLink :to="`/folders/${folder.id}`">
                        <div class="font-semibold text-lg">
                            <icon name="ic:round-folder-open" class="inline-block mr-2 text-primary" />

                            <span>{{ folder.title }}</span>
                        </div>
                        <div v-if="folder.description" class="text-sm text-gray-600">
                            {{ folder.description }}
                        </div>
                        <div v-else class="text-sm text-gray-600">
                            No description available.
                        </div>
                    </NuxtLink>
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
