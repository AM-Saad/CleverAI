<template>
  <shared-page-wrapper title="Folders" subtitle="Manage your folders and organization">
    <div v-if="loading" class="text-gray-500 my-xl">
      <div class="flex items-center gap-4">
        <USkeleton class="h-12 w-12 rounded-full" />

        <div class="grid gap-2">
          <USkeleton class="h-4 w-[250px]" />
          <USkeleton class="h-4 w-[200px]" />
        </div>
      </div>
    </div>
    <shared-error-message v-if="error" :error="error" :refresh="refresh" />
    <div class="mt-4">
      <div v-if="!loading && !folders?.length" class="text-gray-500">
        No folders found.
      </div>
      <ul v-if="folders && folders?.length > 0" class="grid  gap-4">
        <UiCard v-for="folder in folders" :key="folder.id" hover="glow" shadow="none" tag="li">
          <NuxtLink :to="`/folders/${folder.id}`">
            <div class="mb-2 flex items-center">
              <icon name="ic:round-folder-open" class="inline-block mr-2 text-primary" />

              <UiSubtitle>{{ folder.title }}</UiSubtitle>
            </div>
            <UiParagraph v-if="folder.description" class="">
              {{ folder.description }}
            </UiParagraph>
            <div v-else class="">No description available.</div>
          </NuxtLink>
        </UiCard>
      </ul>
    </div>
    <modals-create-folder-form :show="show" @cancel="show = false" />
    <div class="mt-4">
      <UButton @click="show = true">Create Folder</UButton>
    </div>
  </shared-page-wrapper>
</template>

<script setup lang="ts">
const show = ref(false);

const { folders, loading, error, refresh } = useFolders();
watch(error, (newError) => {
  if (newError) {
    console.log(newError);
    useToast().add({
      title: "Error",
      description: newError.message,
    });
  }
});
// Remove automatic notification registration - let users choose
// const { registerNotification } = useNotifications()

// onMounted(() => {
//     registerNotification();
// })
</script>

<style scoped>
/* Add any custom styles here */
</style>
