<script setup lang="ts">
import type { GenerationType } from "../composables/useGenerateFromMaterial";
import type { IconName, MaterialType } from "#imports";

const emit = defineEmits<{
  removed: [id: string];
  error: [err: string];
  generated: [result: { type: GenerationType; savedCount?: number }];
}>();
import { useExportContent } from "~/composables/shared/useExportContent";
import { tint } from "~/composables/useAccentColor";
import GenerateButton from "~/features/materials/components/GenerateButton.vue";

const route = useRoute();
const id = route.params.id;
const toast = useToast();
const { exportContent } = useExportContent();

const {
  materialsList: materials,
  fetching: loading,
  fetchTypedError: error,
  deleteMaterial,
  pendingTranscriptionsList: pendingTranscriptions,
} = useMaterialsStore(id as string);

// Material type to icon mapping
const materialTypeIcons: Record<MaterialType, IconName> = {
  text: "document",
  audio: "mic",
  pdf: "pdf",
  video: "video",
  url: "link",
  document: "sheet",
};

function getMaterialTypeIcon(type?: MaterialType | null): IconName {
  return type ? (materialTypeIcons[type] ?? "document") : "document";
}

const materialTypeColors: Record<MaterialType, string> = {
  audio: "var(--color-error)",
  video: "var(--color-accent-blue)",
  pdf: "var(--color-success)",
  text: "var(--color-warning)",
  url: "var(--color-accent-purple)",
  document: "var(--color-accent-orange)",
};

function getMaterialTypeColor(type?: MaterialType | null): string {
  return type
    ? (materialTypeColors[type] ?? "var(--color-content-secondary)")
    : "var(--color-content-secondary)";
}

function getMaterialTypeLabel(type?: MaterialType | null): string {
  if (!type) return "Material";
  if (type === "pdf" || type === "url") return type.toUpperCase();
  return type[0]?.toUpperCase() + type.slice(1);
}

// Track enrolled materials
const enrolledMaterials = ref(new Set<string>());

// Use shared fullscreen composable
const fullscreen = useFullscreenModal<string>();

// Get current material for fullscreen view
const currentMaterial = computed(() => {
  if (!fullscreen.fullscreenId.value) return null;
  return (
    materials.value.find((m) => m.id === fullscreen.fullscreenId.value) ?? null
  );
});

// Handle generation events
function handleGenerated(result: {
  type: GenerationType;
  savedCount?: number;
}) {
  emit("generated", result);
  // Optionally show a toast or trigger a refresh
  const itemType = result.type === "flashcards" ? "flashcards" : "questions";
  toast.add({
    title: "Content Generated",
    description: `Successfully generated ${result.savedCount || 0} ${itemType}`,
    color: "success",
  });
}

function handleGenerateError(message: string) {
  emit("error", message);
  toast.add({
    title: "Generation Failed",
    description: message,
    color: "error",
  });
}

const removeMaterial = async (materialId: string) => {
  fullscreen.close();
  emit("removed", materialId);
  const result = await deleteMaterial(materialId);

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

    <ui-paragraph
      class="mt-2"
      v-if="
        !loading &&
        materials.length === 0 &&
        pendingTranscriptions.length === 0 &&
        !error
      "
      color="disabled"
    >
      No materials in this workspace.
    </ui-paragraph>

    <ul
      v-if="
        !loading && (materials.length > 0 || pendingTranscriptions.length > 0)
      "
      class=""
    >
      <!-- Pending Transcription Rows -->
      <UiListCard
        v-for="pt in pendingTranscriptions"
        :key="pt.id"
        as="li"
        variant="ghost"
        size="sm"
        class-name="my-1 opacity-80"
        :title="pt.title"
        :description="
          pt.status === 'transcribing' ? 'Transcribing...' : 'Saving...'
        "
        :leading-background="tint('var(--color-error)', 14)"
        leading-color="var(--color-error)"
      >
        <template #leading>
          <Icon
            name="i-lucide-mic"
            class="h-4 w-4 animate-pulse"
            aria-hidden="true"
          />
        </template>
        <template #trailing>
          <span class="materials-list__status">
            <Icon
              name="i-lucide-loader"
              class="h-3 w-3 animate-spin"
              aria-hidden="true"
            />
            {{ pt.status === "transcribing" ? "Transcribing..." : "Saving..." }}
          </span>
        </template>
      </UiListCard>

      <!-- Actual Materials -->
      <li v-for="m in materials" :key="m.id" class="my-1">
        <UiListCard
          clickable
          size="sm"
          variant="soft"
          :description="getMaterialTypeLabel(m.type)"
          :leading-background="tint(getMaterialTypeColor(m.type), 14)"
          :leading-color="getMaterialTypeColor(m.type)"
          @click="() => fullscreen.open(m.id)"
        >
          <template #title>
            <span dir="auto">{{ m.title }}</span>
          </template>
          <template #leading>
            <shared-icon
              :name="getMaterialTypeIcon(m.type)"
              :size="UI_CONFIG.ICON_SIZE"
              aria-hidden="true"
            />
          </template>
          <template v-if="enrolledMaterials.has(m.id)" #trailing>
            <UiPill
              size="sm"
              label="Enrolled"
              color="var(--color-success)"
              variant="outline"
              active
              max-width="100px"
            >
              <template #icon>
                <UiPillIcon name="i-lucide-check-circle" size="sm" />
              </template>
            </UiPill>
          </template>
        </UiListCard>
      </li>
    </ul>

    <!-- Fullscreen Material View -->
    <shared-fullscreen-wrapper
      :is-open="fullscreen.isOpen.value"
      :aria-label="currentMaterial?.title ?? 'Material'"
      @close="fullscreen.close"
    >
      <template #header>
        <div class="flex w-full justify-between items-center gap-2 flex-wrap">
          <ui-subtitle dir="auto">{{ currentMaterial?.title }}</ui-subtitle>

          <div class="flex shrink-0 gap-2 items-center">
            <!-- Generate button -->
            <GenerateButton
              v-if="currentMaterial"
              :material-id="currentMaterial.id"
              :material-content="currentMaterial.content"
              @generated="handleGenerated"
              @error="handleGenerateError"
            />

            <UiActionMenu
              v-if="currentMaterial"
              :items="[
                [
                  {
                    label: 'Download as TXT',
                    icon: 'i-lucide-file-text',
                    onSelect: () =>
                      exportContent(
                        currentMaterial!.title,
                        currentMaterial!.content,
                        'txt',
                      ),
                  },
                  {
                    label: 'Download as DOC',
                    icon: 'i-lucide-file',
                    onSelect: () =>
                      exportContent(
                        currentMaterial!.title,
                        currentMaterial!.content,
                        'doc',
                      ),
                  },
                  {
                    label: 'Download as PDF',
                    icon: 'i-lucide-file',
                    onSelect: () =>
                      exportContent(
                        currentMaterial!.title,
                        currentMaterial!.content,
                        'pdf',
                      ),
                  },
                ],
              ]"
            >
              <ui-button variant="soft" color="primary" size="sm">
                <icon name="i-lucide-download" class="w-4 h-4 mr-1" />
                Download
              </ui-button>
            </UiActionMenu>

            <UiDoubleTapDeleteButton
              v-if="currentMaterial"
              label="Remove"
              armed-label="Tap again to remove"
              tone="error"
              variant="soft"
              size="sm"
              :loading="loading"
              :reset-key="currentMaterial.id"
              @confirm="removeMaterial(currentMaterial.id)"
            />
            <ui-button
              variant="soft"
              color="primary"
              size="sm"
              @click="fullscreen.close"
              aria-label="Close fullscreen"
            >
              <icon name="i-lucide-minimize-2" class="w-3 h-3" />
            </ui-button>
          </div>
        </div>

        <span
          v-if="currentMaterial && enrolledMaterials.has(currentMaterial.id)"
          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success/15 text-success-text mt-2"
        >
          <icon name="i-lucide-check-circle" class="w-3 h-3 mr-1" />
          Enrolled
        </span>
      </template>

      <UiCard tag="article" variant="ghost">
        <ui-paragraph class="whitespace-pre-wrap" size="lg" dir="auto">{{
          currentMaterial?.content
        }}</ui-paragraph>
      </UiCard>
    </shared-fullscreen-wrapper>
  </div>
</template>

<style scoped>
.materials-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.materials-list__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning-text);
  font-size: 10px;
  font-weight: 600;
}
</style>
