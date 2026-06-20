<script setup lang="ts">
import type { GenerationType } from "../composables/useGenerateFromMaterial";
import type { IconName, MaterialType } from "#imports";

const emit = defineEmits<{
  removed: [id: string];
  error: [err: string];
  generated: [result: { type: GenerationType; savedCount?: number }];
}>();
import { useExportContent } from "~/composables/shared/useExportContent";
import GenerateButton from "~/features/materials/components/GenerateButton.vue";

const route = useRoute();
const id = route.params.id;
const toast = useToast();
const { exportContent } = useExportContent();

const showConfirm = ref(false);
const confirmId = ref<string | null>(null);

const {
  materialsList: materials,
  fetching: loading,
  fetchTypedError: error,
  deleteMaterial,
  pendingTranscriptionsList: pendingTranscriptions,
} = useMaterialsStore(id as string);

// Material type to icon mapping
const materialTypeIcons: Record<MaterialType, IconName> = {
  text: 'document',
  audio: 'mic',
  pdf: 'pdf',
  video: 'video',
  url: 'link',
  document: 'sheet',
};

function getMaterialTypeIcon(type: MaterialType): IconName {
  const mappedType = materialTypeIcons[type || ''];
  return mappedType || 'i-lucide-file';
}

// Material type to border color mapping
const materialTypeColors: Record<MaterialType, string> = {
  audio: 'border-l-2 border-l-rose-500/50',
  video: 'border-l-2 border-l-blue-500/50',
  pdf: 'border-l-2 border-l-green-500/50',
  text: 'border-l-2 border-l-yellow-500/50',
  url: 'border-l-2 border-l-purple-500/50',
  document: 'border-l-2 border-l-orange-500/50',
};

function getMaterialTypeColor(type: MaterialType): string {
  return materialTypeColors[type || ''] || '';
}

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

<template>
  <div class="materials-list">
    <ui-loader :is-fetching="loading" label="Loading Materials..." />

    <shared-server-error :loading="loading" v-model:typedError="error" />

    <ui-paragraph class="mt-2" v-if="!loading && materials.length === 0 && pendingTranscriptions.length === 0 && !error"
      color="disabled">
      No materials in this workspace.
    </ui-paragraph>

    <ul v-if="!loading && (materials.length > 0 || pendingTranscriptions.length > 0)" class="">
      <!-- Pending Transcription Rows -->
      <UiPanel v-for="pt in pendingTranscriptions" :key="pt.id" tag="li" variant="transparent" size="sm"
        class-name="my-1 rounded-none! border-x-0 border-t-0 opacity-80">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <icon name="i-lucide-mic" class="w-4 h-4 text-error-text shrink-0 animate-pulse" />
            <ui-subtitle weight="normal" size="xs" class="truncate" color="content-on-surface">{{ pt.title
              }}</ui-subtitle>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/15 text-warning-text shrink-0">
              <icon name="i-lucide-loader" class="w-3 h-3 animate-spin" />
              {{ pt.status === 'transcribing' ? 'Transcribing...' : 'Saving...' }}
            </span>
          </div>
        </div>
      </UiPanel>

      <!-- Actual Materials -->
      <li v-for="(m, idx) in materials" :key="m.id" class="my-1">
        <UiInteractiveCard size="sm" variant="surface" :class-name="['group',
          getMaterialTypeColor(m.type!)
        ].join(' ')" @click="() => fullscreen.open(m.id)">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <shared-icon :name="getMaterialTypeIcon(m.type!)" :size="UI_CONFIG.ICON_SIZE" />
              <ui-subtitle weight="normal" size="xs" class="truncate" color="content-on-background">
                {{ m.title }}</ui-subtitle>
              <span v-if="enrolledMaterials.has(m.id)"
                class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success/15 text-success-text shrink-0">
                <icon name="i-lucide-check-circle" class="w-3 h-3 mr-1" />
                Enrolled
              </span>
            </div>
          </div>
        </UiInteractiveCard>
      </li>
    </ul>



    <!-- Fullscreen Material View -->
    <shared-fullscreen-wrapper :is-open="fullscreen.isOpen.value" :aria-label="currentMaterial?.title ?? 'Material'"
      @close="fullscreen.close">
      <template #header>
        <div class="flex w-full justify-between items-center gap-2 flex-wrap">
          <ui-subtitle>{{ currentMaterial?.title }}</ui-subtitle>

          <div class="flex shrink-0 gap-2 items-center">
            <!-- Generate button -->
            <GenerateButton v-if="currentMaterial" :material-id="currentMaterial.id"
              :material-content="currentMaterial.content" @generated="handleGenerated" @error="handleGenerateError" />

            <UDropdownMenu v-if="currentMaterial" :items="[
              [
                { label: 'Download as TXT', icon: 'i-heroicons-document-text', onSelect: () => exportContent(currentMaterial!.title, currentMaterial!.content, 'txt') },
                { label: 'Download as DOC', icon: 'i-heroicons-document', onSelect: () => exportContent(currentMaterial!.title, currentMaterial!.content, 'doc') },
                { label: 'Download as PDF', icon: 'i-heroicons-document', onSelect: () => exportContent(currentMaterial!.title, currentMaterial!.content, 'pdf') }
              ]
            ]">
              <ui-button variant="outline" color="primary" size="sm">
                <icon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
                Download
              </ui-button>
            </UDropdownMenu>

            <ui-button color="error" size="sm" variant="outline"
              @click="() => { if (currentMaterial) confirmRemoval(currentMaterial.id) }">
              Remove
            </ui-button>
            <ui-button variant="subtle" color="primary" size="sm" @click="fullscreen.close"
              aria-label="Close fullscreen">
              <icon name="i-heroicons-arrows-pointing-in" class="w-3 h-3" />
            </ui-button>
          </div>
        </div>

        <span v-if="currentMaterial && enrolledMaterials.has(currentMaterial.id)"
          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success/15 text-success-text mt-2">
          <icon name="i-lucide-check-circle" class="w-3 h-3 mr-1" />
          Enrolled
        </span>
      </template>

      <UiCard tag="article" variant="ghost">
        <ui-paragraph class="whitespace-pre-wrap" size="lg">{{ currentMaterial?.content }}</ui-paragraph>
      </UiCard>
    </shared-fullscreen-wrapper>
  </div>

  <shared-delete-confirmation-modal :show="showConfirm" title="Delete Material" @close="showConfirm = false"
    @confirm="doConfirmRemove" :loading="loading">
    Are you sure you want to delete this material? This action cannot be undone.
  </shared-delete-confirmation-modal>
</template>

<style scoped>
.materials-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
