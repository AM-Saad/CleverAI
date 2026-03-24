<script setup lang="ts">
const toast = useToast();
const show = ref(false);
const listView = ref<'grid' | 'list'>('grid');

const showDeleteConfirm = ref(false);
const workspaceToDelete = ref<string | null>(null);
const editWorkspace = ref<Workspace | null>(null);
const { workspaces, loading, error, refresh } = useWorkspaces();
const { deleteWorkspace, deleting: deletingWorkspace } = useDeleteWorkspace(refresh);

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
  editWorkspace.value = null;
};
const confirmDeleteWorkspace = async () => {
  if (!workspaceToDelete.value) return;
  try {
    await deleteWorkspace(workspaceToDelete.value);
    toast.add({
      title: "Workspace Deleted",
      description: "The workspace has been successfully deleted.",
      color: "success",
    });
    window.dispatchEvent(new CustomEvent("refresh-review-stats"));

  } catch (err) {
    toast.add({
      title: "Error",
      description: "An error occurred while deleting the workspace.",
    });
  } finally {
    showDeleteConfirm.value = false;
    workspaceToDelete.value = null;
  }
};

const toggleView = () => {
  listView.value = listView.value === 'grid' ? 'list' : 'grid';
  localStorage.setItem('workspaceListView', listView.value);
};



// Load saved view preference from localStorage
onMounted(() => {
  const savedView = localStorage.getItem('workspaceListView') as 'grid' | 'list' || 'grid';
  listView.value = savedView;
  if (import.meta.dev) {
    console.log("[workspaces/index] forcing refresh() onMounted", { timestamp: Date.now() });
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
    <board-notes-section />

    <shared-error-message v-if="error" :error="error" :refresh="refresh" />

    <div>
      <!-- <ui-card class="mb-4 p-0!" size="md" variant="ghost" content-classes="p-0! p-0.5!">
        <template #default> -->

      <div class="flex gap-3 justify-between items-end mb-4">
        <!-- Future filter options can go here -->
        <div class="basis-2/4 md:basis-3/4">
          <UiLabel for="search">Search</UiLabel>
          <u-input id="search" type="text" placeholder="Search workspaces..." class="mt-1 w-full" />
        </div>
        <div class="flex gap-2 items-center place-self-end">
          <u-button @click="show = true" size="sm">Create Workspace</u-button>
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
      <div v-if="!loading && !workspaces?.length" class="text-gray-500">
        No workspaces found.
      </div>
      <ul v-if="workspaces && workspaces?.length > 0 && !loading"
        :class="listView === 'grid' ? 'grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'space-y-4'">
        <u-context-menu :items="[
          {
            label: 'Edit Workspace',
            icon: 'i-lucide-edit',

            onSelect: () => {
              console.log('Edit workspace');
              editWorkspace = workspace;
              show = true;
            },
          },
          {
            label: 'Delete Workspace',
            icon: 'i-lucide-trash',
            disabled: deletingWorkspace,
            onSelect: () => {
              console.log('Delete workspace');
              workspaceToDelete = workspace.id;
              showDeleteConfirm = true;
            },
          },
        ]" v-for="workspace in workspaces" :key="workspace.id">
          <ui-card hover="lift" shadow="none" tag="li" variant="default">
            <NuxtLink :to="`/workspaces/${workspace.id}`">
              <div class="mb-1 flex items-center">
                <icon name="ic:round-workspace-open" class="inline-block mr-1 text-primary" size="22" />

                <ui-subtitle size="sm" color="content-on-surface">{{ workspace.title }}</ui-subtitle>
              </div>
              <ui-paragraph v-if="workspace.description" color="disabled">
                {{ workspace.description }}
              </ui-paragraph>
              <ui-paragraph v-else color="disabled">No description available.</ui-paragraph>
            </NuxtLink>
          </ui-card>
        </u-context-menu>
      </ul>
    </div>
    <workspace-upsert-workspace-form :show="show" @cancel="cancelUpsertModal" @created="refresh()"
      :workspace="editWorkspace" />

    <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Workspace"
      @close="showDeleteConfirm = false" :loading="deletingWorkspace" @confirm="confirmDeleteWorkspace">
      Are you sure you want to delete this workspace? This action cannot be undone.
    </shared-delete-confirmation-modal>
  </shared-page-wrapper>
</template>
