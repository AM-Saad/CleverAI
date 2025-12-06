<script setup lang="ts">
import type { GenerationType } from "~/composables/materials/useGenerateFromMaterial";
import { useGenerateFromMaterial } from "~/composables/materials/useGenerateFromMaterial";

interface Props {
  materialId: string;
  materialContent?: string;
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (event: "generated", result: { type: GenerationType; savedCount?: number }): void;
  (event: "error", error: string): void;
}>();

// Create a computed ref for the materialId
const materialIdRef = computed(() => props.materialId);

// Get shared subscription state and fetch on mount if not already fetched
const { hasFetched, fetchSubscriptionStatus } = useSubscription();

onMounted(async () => {
  if (!hasFetched.value) {
    await fetchSubscriptionStatus();
  }
});

// Use the composable
const {
  generating,
  genError,
  lastResult,
  showConfirmDialog,
  pendingGenerationType,
  existingCounts,
  startGenerate,
  confirmRegenerate,
  cancelRegenerate,
  rateLimitRemaining,
  subscriptionInfo,
  isQuotaExceeded,
} = useGenerateFromMaterial(materialIdRef);

// Dropdown items - using onSelect for Nuxt UI v4 UDropdownMenu
const dropdownItems = computed(() => [
  [
    {
      label: "Flashcards",
      icon: "i-lucide-layers",
      onSelect: () => handleGenerate("flashcards"),
      disabled: generating.value || !hasContent.value,
    },
    {
      label: "Questions",
      icon: "i-lucide-help-circle",
      onSelect: () => handleGenerate("quiz"),
      disabled: generating.value || !hasContent.value,
    },
  ],
]);

// Check if material has content
const hasContent = computed(() => {
  return props.materialContent && props.materialContent.trim().length > 0;
});

// Handle generation
async function handleGenerate(type: GenerationType) {
  if (!hasContent.value) {
    emit("error", "This material has no content. Please add content first.");
    return;
  }
  await startGenerate(type);
}

// Watch for results and errors
watch(lastResult, (result) => {
  if (result) {
    emit("generated", {
      type: result.type,
      savedCount: result.savedCount,
    });
  }
});

watch(genError, (error) => {
  if (error) {
    emit("error", error);
  }
});
</script>

<template>
  <div class="flex items-center">
    <!-- Rate limit badge -->
    <u-badge v-if="rateLimitRemaining !== null && subscriptionInfo.tier === 'FREE'" size="sm"
      :color="rateLimitRemaining >= 10 ? 'success' : rateLimitRemaining >= 3 ? 'warning' : 'error'" class="mr-2">
      {{ rateLimitRemaining }} left
    </u-badge>

    <!-- Generate dropdown button -->
    <UDropdownMenu :items="dropdownItems" :content="{ align: 'end', side: 'bottom', sideOffset: 4 }"
      :ui="{ content: 'w-40' }">
      <u-button color="primary" size="xs" :loading="generating" :disabled="disabled || isQuotaExceeded || !hasContent"
        aria-label="Generate Study Tools" variant="soft">
        <span v-if="!generating">Generate</span>
        <span v-else>Generating…</span>
        <template #trailing>
          <icon name="i-lucide-chevron-down" size="14" />
        </template>
      </u-button>
    </UDropdownMenu>

    <!-- Tooltip for disabled state -->
    <u-tooltip v-if="!hasContent" text="Add content to this material first" :popper="{ placement: 'top' }">
      <span class="sr-only">No content available</span>
    </u-tooltip>

    <!-- Regenerate Confirmation Dialog -->
    <materials-regenerate-confirm-dialog :show="showConfirmDialog" :generation-type="pendingGenerationType"
      :existing-counts="existingCounts" :loading="generating" @confirm="confirmRegenerate" @cancel="cancelRegenerate" />
  </div>
</template>
