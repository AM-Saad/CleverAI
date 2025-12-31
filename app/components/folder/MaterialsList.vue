<template>
  <div class="materials-list">
    <ui-loader :is-fetching="loading" label="Loading Materials..." />

    <shared-server-error :loading="loading" v-model:typedError="error" />

    <ul v-if="!loading && materials.length > 0" class="">
      <ui-card v-for="m in materials" :key="m.id" tag="li" variant="ghost" size="sm" shadow="none" :hover="'lift'"
        class="cursor-pointer group my-2 border-b border-muted rounded-none!" @click="() => fullscreen.open(m.id)">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <ui-subtitle weight="normal" size="xs" class="truncate">{{ m.title }}</ui-subtitle>
            <span v-if="enrolledMaterials.has(m.id)"
              class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0">
              <icon name="i-lucide-check-circle" class="w-3 h-3 mr-1" />
              Enrolled
            </span>
          </div>
          <div class="shrink-0 flex items-center gap-2" @click.stop>
            <!-- Generate button -->
            <!-- <materials-generate-button :material-id="m.id" :material-content="m.content" @generated="handleGenerated"
              @error="handleGenerateError" /> -->
          </div>
        </div>
      </ui-card>
    </ul>

    <ui-paragraph v-if="!loading && materials.length === 0 && !error" color="muted">
      No materials in this folder.
    </ui-paragraph>

    <!-- Fullscreen Material View -->
    <shared-fullscreen-wrapper :is-open="fullscreen.isOpen.value" :aria-label="currentMaterial?.title ?? 'Material'"
      @close="fullscreen.close">
      <template #header>
        <div class="flex w-full justify-between items-center gap-2 flex-wrap">
          <ui-subtitle>{{ currentMaterial?.title }}</ui-subtitle>

          <div class="flex shrink-0 gap-2 items-center">
            <!-- Generate button -->
            <materials-generate-button v-if="currentMaterial" :material-id="currentMaterial.id"
              :material-content="currentMaterial.content" @generated="handleGenerated" @error="handleGenerateError" />

            <u-button color="error" size="xs" variant="outline"
              @click="() => { if (currentMaterial) confirmRemoval(currentMaterial.id) }">
              Remove
            </u-button>
            <u-button variant="subtle" color="primary" size="xs" @click="fullscreen.close"
              aria-label="Close fullscreen">
              <icon name="i-heroicons-arrows-pointing-in" class="w-3 h-3" />
            </u-button>
          </div>
        </div>

        <span v-if="currentMaterial && enrolledMaterials.has(currentMaterial.id)"
          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mt-2">
          <icon name="i-lucide-check-circle" class="w-3 h-3 mr-1" />
          Enrolled
        </span>
      </template>

      <ui-card tag="article" variant="ghost">
        <ui-paragraph class="whitespace-pre-wrap">{{ currentMaterial?.content }}</ui-paragraph>
      </ui-card>
    </shared-fullscreen-wrapper>
  </div>

  <shared-delete-confirmation-modal :show="showConfirm" title="Delete Material" @close="showConfirm = false"
    @confirm="doConfirmRemove" :loading="loading">
    Are you sure you want to delete this material? This action cannot be undone.
  </shared-delete-confirmation-modal>
</template>

<script setup lang="ts">
import type { GenerationType } from "~/composables/materials/useGenerateFromMaterial";

const emit = defineEmits<{
  removed: [id: string];
  error: [err: string];
  generated: [result: { type: GenerationType; savedCount?: number }];
}>();
const route = useRoute();
const id = route.params.id;
const toast = useToast();

const showConfirm = ref(false);
const confirmId = ref<string | null>(null);

const {
  materialsList: materials,
  fetching: loading,
  fetchTypedError: error,
  deleteMaterial,
} = useMaterialsStore(id as string);

// Track enrolled materials
const enrolledMaterials = ref(new Set<string>());

// Use shared fullscreen composable
const fullscreen = useFullscreenModal<string>();

// Get current material for fullscreen view
const currentMaterial = computed(() => {
  if (!fullscreen.fullscreenId.value) return null;
  return materials.value.find((m) => m.id === fullscreen.fullscreenId.value) ?? null;
});


// Handle generation events
function handleGenerated(result: { type: GenerationType; savedCount?: number }) {
  emit("generated", result);
  // Optionally show a toast or trigger a refresh
  const itemType = result.type === "flashcards" ? "flashcards" : "questions";
  toast.add({
    title: "Content Generated",
    description: `Successfully generated ${result.savedCount || 0} ${itemType}`,
    color: "success",
  });
}

function handleGenerateError(error: string) {
  emit("error", error);
  toast.add({
    title: "Generation Failed",
    description: error,
    color: "error",
  });
}

const confirmRemoval = (id: string) => {
  confirmId.value = id;
  showConfirm.value = true;
};

const doConfirmRemove = async () => {
  if (!confirmId.value) return;

  showConfirm.value = false;
  fullscreen.close();
  emit("removed", confirmId.value);
  const result = await deleteMaterial(confirmId.value);
  confirmId.value = null;

  if (result) {
    // Success - result is not null
  } else if (error.value) {
    // Error occurred - use centralized error details
    emit("error", error.value.message);
  }
};
</script>

<style scoped>
.materials-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
