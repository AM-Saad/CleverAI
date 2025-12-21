<template>
  <shared-page-wrapper title="Folders" subtitle="Manage your folders and organization">
    <!-- Review Status Card (Global) -->
    <review-status-card class="mb-6" :show-context="false"
      empty-message="Enroll flashcards or materials to start reviewing" />

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
      <ui-card v-if="folders && folders.length > 0" class="mb-4 p-0!" size="md" variant="ghost">
        <template #default>

          <!-- <UiLabel class="flex items-center" size="lg">
            <icon name="ic:round-filter-list" class="inline-block mr-2" />
            Filters
          </UiLabel> -->

          <div class="flex gap-3 justify-between items-end">
            <!-- Future filter options can go here -->
            <div class="basis-3/4">
              <UiLabel for="search">Search</UiLabel>
              <u-input id="search" type="text" placeholder="Search folders..." class="mt-1 w-full" />
            </div>
            <!-- <UiLabel for="sort">Sort By</UiLabel>
              <u-select-menu id="sort" :items="[
                { label: 'Name (A-Z)', value: 'name_asc' },
                { label: 'Name (Z-A)', value: 'name_desc' },
                { label: 'Date Created (Newest)', value: 'date_desc' },
                { label: 'Date Created (Oldest)', value: 'date_asc' },
              ]" class="w-full" /> -->
            <u-button variant="subtle" @click="toggleView" class="place-self-end">
              <icon v-if="listView === 'grid'" name="i-lucide-list" class="inline-block" />
              <icon v-else name="i-lucide-grid" class="inline-block" />
            </u-button>
          </div>
        </template>
      </ui-card>
      <ul v-if="folders && folders?.length > 0"
        :class="listView === 'grid' ? 'grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'space-y-4'">
        <ui-card v-for="folder in folders" :key="folder.id" hover="lift" shadow="none" tag="li" variant="default">
          <NuxtLink :to="`/folders/${folder.id}`">
            <div class="mb-1 flex items-center">
              <icon name="ic:round-folder-open" class="inline-block mr-2 text-primary" />

              <ui-subtitle>{{ folder.title }}</ui-subtitle>
            </div>
            <ui-paragraph v-if="folder.description">
              {{ folder.description }}
            </ui-paragraph>
            <ui-paragraph v-else>No description available.</ui-paragraph>
          </NuxtLink>
        </ui-card>
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
const listView = ref<'grid' | 'list'>('grid');


const { folders, loading, error, refresh } = useFolders();
console.log("Folders data:", folders);
watch(error, (newError) => {
  if (newError) {
    console.log(newError);
    useToast().add({
      title: "Error",
      description: newError.message,
    });
  }
});

// Load saved view preference from localStorage
onMounted(() => {
  const savedView = localStorage.getItem('folderListView') as 'grid' | 'list' || 'grid';
  listView.value = savedView;
  if (import.meta.dev) {
    console.log("[folders/index] forcing refresh() onMounted", { timestamp: Date.now() });
    refresh();
  }
});

const toggleView = () => {
  listView.value = listView.value === 'grid' ? 'list' : 'grid';
  localStorage.setItem('folderListView', listView.value);
};

// Remove automatic notification registration - let users choose
// const { registerNotification } = useNotifications()

// onMounted(() => {
//     registerNotification();
// })
</script>

<style scoped>
/* Add any custom styles here */
</style>
