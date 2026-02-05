<script setup lang="ts">
const toast = useToast();
const show = ref(false);
const listView = ref<'grid' | 'list'>('grid');

const showDeleteConfirm = ref(false);
const folderToDelete = ref<string | null>(null);
const editFolder = ref<Folder | null>(null);
const { folders, loading, error, refresh } = useFolders();
const { deleteFolder, deleting: deletingFolder } = useDeleteFolder(refresh);

watch(error, (newError) => {
  if (newError) {
    toast.add({
      title: "Error",
      description: newError.message,
    });
  }
});



const cancelUpsertModal = () => {
  show.value = false;
  editFolder.value = null;
};
const confirmDeleteFolder = async () => {
  if (!folderToDelete.value) return;
  try {
    await deleteFolder(folderToDelete.value);
    toast.add({
      title: "Folder Deleted",
      description: "The folder has been successfully deleted.",
      color: "success",
    });
    window.dispatchEvent(new CustomEvent("refresh-review-stats"));

  } catch (err) {
    toast.add({
      title: "Error",
      description: "An error occurred while deleting the folder.",
    });
  } finally {
    showDeleteConfirm.value = false;
    folderToDelete.value = null;
  }
};

const toggleView = () => {
  listView.value = listView.value === 'grid' ? 'list' : 'grid';
  localStorage.setItem('folderListView', listView.value);
};



// Load saved view preference from localStorage
onMounted(() => {
  const savedView = localStorage.getItem('folderListView') as 'grid' | 'list' || 'grid';
  listView.value = savedView;
  if (import.meta.dev) {
    console.log("[folders/index] forcing refresh() onMounted", { timestamp: Date.now() });
    refresh();
  }
});
</script>


<template>
  <shared-page-wrapper>
    <!-- Review Status Card (Global) -->
    <review-status-card class="mb-6" :show-context="false"
      empty-message="Enroll flashcards or materials to start reviewing" />

    <!-- Board Notes Section -->
    <!-- <shared-board-notes-section /> -->

    <shared-error-message v-if="error" :error="error" :refresh="refresh" />

    <div>
      <!-- <ui-card class="mb-4 p-0!" size="md" variant="ghost" content-classes="p-0! p-0.5!">
        <template #default> -->

      <div class="flex gap-3 justify-between items-end mb-4">
        <!-- Future filter options can go here -->
        <div class="basis-2/4 md:basis-3/4">
          <UiLabel for="search">Search</UiLabel>
          <u-input id="search" type="text" placeholder="Search folders..." class="mt-1 w-full" />
        </div>
        <div class="flex gap-2 items-center place-self-end">
          <u-button @click="show = true" size="sm">Create Folder</u-button>
          <u-button variant="subtle" @click="toggleView">
            <icon v-if="listView === 'grid'" name="i-lucide-list" class="inline-block" />
            <icon v-else name="i-lucide-grid" class="inline-block" />
          </u-button>
        </div>

      </div>
      <!-- </template>
</ui-card> -->
      <div v-if="loading">
        <div :class="listView === 'grid' ? 'grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'space-y-4'">
          <ui-card shadow="none" tag="li" variant="default" v-for="n in 3" :key="n">
            <div class="grid gap-2">
              <USkeleton class="h-4 w-[250px] bg-muted/50 dark:bg-muted/30" />
              <USkeleton class="h-4 w-[200px] bg-muted/50 dark:bg-muted/30" />
            </div>
          </ui-card>
        </div>
      </div>
      <div v-if="!loading && !folders?.length" class="text-gray-500">
        No folders found.
      </div>
      <ul v-if="folders && folders?.length > 0 && !loading"
        :class="listView === 'grid' ? 'grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'space-y-4'">
        <u-context-menu :items="[
          {
            label: 'Edit Folder',
            icon: 'i-lucide-edit',

            onSelect: () => {
              console.log('Edit folder');
              editFolder = folder;
              show = true;
            },
          },
          {
            label: 'Delete Folder',
            icon: 'i-lucide-trash',
            disabled: deletingFolder,
            onSelect: () => {
              console.log('Delete folder');
              folderToDelete = folder.id;
              showDeleteConfirm = true;
            },
          },
        ]" v-for="folder in folders" :key="folder.id">
          <ui-card hover="lift" shadow="none" tag="li" variant="default">
            <NuxtLink :to="`/folders/${folder.id}`">
              <div class="mb-1 flex items-center">
                <icon name="ic:round-folder-open" class="inline-block mr-1 text-primary" size="22" />

                <ui-subtitle size="sm" color="onsurface">{{ folder.title }}</ui-subtitle>
              </div>
              <ui-paragraph v-if="folder.description">
                {{ folder.description }}
              </ui-paragraph>
              <ui-paragraph v-else>No description available.</ui-paragraph>
            </NuxtLink>
          </ui-card>
        </u-context-menu>
      </ul>
    </div>
    <folder-upsert-folder-form :show="show" @cancel="cancelUpsertModal" @created="refresh()" :folder="editFolder" />

    <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Folder" @close="showDeleteConfirm = false"
      :loading="deletingFolder" @confirm="confirmDeleteFolder">
      Are you sure you want to delete this folder? This action cannot be undone.
    </shared-delete-confirmation-modal>
  </shared-page-wrapper>
</template>
