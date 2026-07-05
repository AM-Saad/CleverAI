<template>
  <UiCard :class="[
    'transition-all duration-200 shrink-0',
    cardClasses,
  ]" :variant="minimal ? 'ghost' : 'default'" :size="minimal ? 'xs' : 'sm'">
    <!-- Loading State -->
    <template #header v-if="!minimal">
      <div class="flex items-center justify-between w-full">
        Review Status
        <ui-button v-if="showRefresh" size="xs" variant="ghost" :is-loading="isLoading" @click="refresh">
          <!-- <Icon name="i-lucide-refresh-cw" :class="['w-4 h-4', isLoading ? 'animate-spin' : '']" /> -->
          <shared-icon :name="'reload'" />
        </ui-button>
      </div>
    </template>
    <ui-loader v-if="isLoading" :is-fetching="isLoading" />

    <!-- Error State -->
    <shared-server-error v-if="typedError && !isLoading" :typedError="typedError" :loading="isLoading"
      :refresh="refresh" />


    <!-- Empty State (no cards enrolled) -->
    <div v-if="isEmpty && !isLoading && !error" :class="`text-center ${minimal ? 'flex items-center gap-2' : ''}`">
      <Icon name="i-lucide-graduation-cap" class="text-content-disabled" :size="UI_CONFIG.ICON_SIZE" />
      <ui-paragraph size="xs">
        {{ emptyMessage }}
      </ui-paragraph>
      <slot name="empty-action" />
    </div>

    <!-- Stats Display -->
    <div v-if="!isLoading && !error && !isEmpty"
      :class="`text-center flex flex-col items-center md:flex-row gap-3 md:gap-0 ${minimal ? '' : ''}`">
      <!-- Header with status message -->
      <div class="flex items-center justify-between md:justify-start gap-2 w-full flex-wrap">
        <div class="flex items-center gap-2">
          <div :class="[minimal ? 'w-2 h-2' : 'w-3 h-3', 'rounded-full', urgencyIndicatorClass]" />
          <ui-paragraph size="base">
            {{ statusMessage }}
          </ui-paragraph>
        </div>
        <!-- Action Button -->
        <div v-if="showAction && hasDueCards">
          <ui-button :to="reviewLink" size="sm">
            <!-- <Icon name="i-lucide-play" class="w-4 h-4" /> -->
            Start Review
            <span v-if="stats?.due" class=" opacity-75">({{ stats.due }})</span>
          </ui-button>
        </div>

      </div>

      <!-- Stats Grid - Full variant for default/outline -->
      <div v-if="!minimal" class="flex md:justify-end justify-start gap-1 text-center w-full overflow-auto">
        <ui-badge class="flex grid-1" variant="soft" color="error">
          <div class="text-error-text">Due</div>

          <div class="text-error-text">
            {{ stats?.due ?? 0 }}
          </div>
        </ui-badge>
        <ui-badge class="flex grid-1" variant="soft" color="primary">
          <div class="text-info-text">New</div>

          <div class="text-info-text">
            {{ stats?.new ?? 0 }}
          </div>
        </ui-badge>
        <ui-badge class="flex grid-1" variant="soft" color="warning">
          <div class="text-warning-text">Learning</div>

          <div class="text-warning-text">
            {{ stats?.learning ?? 0 }}
          </div>
        </ui-badge>
        <ui-badge class="flex grid-1" variant="soft" color="success">
          <div class="text-success-text">Mature</div>

          <div class="text-success-text">
            {{ stats?.mature ?? 0 }}
          </div>
        </ui-badge>
      </div>


      <!-- Context info (workspace name) if available -->
      <div v-if="stats?.context?.workspaceTitle && showContext" class="mt-3 pt-3 border-t border-secondary">
        <div class="flex items-center text-sm text-content-secondary">
          <Icon name="i-lucide-folder" class="w-4 h-4 mr-1" />
          {{ stats.context.workspaceTitle }}
        </div>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import type { ReviewSummaryStats } from "~/shared/utils/review.contract";

interface Props {
  /** Workspace ID for workspace-specific stats (omit for global) */
  workspaceId?: string;
  /** Pre-loaded stats (skip fetch if provided) */
  initialStats?: ReviewSummaryStats;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Show action button (Start Review) */
  showAction?: boolean;
  /** Show workspace context info */
  showContext?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Card variant */
  variant?: "default" | "ghost" | "outline";
  /** Custom empty message */
  emptyMessage?: string;

  minimal?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  workspaceId: undefined,
  initialStats: undefined,
  showRefresh: true,
  showAction: true,
  showContext: false,
  compact: false,
  variant: "default",
  emptyMessage: "No cards enrolled for review yet",
  minimal: false,
});

// Use composable for data fetching
const {
  stats,
  isLoading,
  error,
  typedError,
  hasDueCards,
  isEmpty,
  statusMessage,
  urgencyLevel,
  refresh,
} = useReviewStats({
  workspaceId: computed(() => props.workspaceId),
  immediate: !props.initialStats,
});

watch(() => typedError, (newStats) => {
  console.log("newStats", newStats);
});
// If initial stats provided, use them
if (props.initialStats) {
  // @ts-expect-error - we're intentionally setting ref value
  stats.value = props.initialStats;
}

// Computed: Review link (with or without workspace filter)
const reviewLink = computed(() => {
  const base = "/user/review";
  return props.workspaceId ? `${base}?workspaceId=${props.workspaceId}` : base;
});

const isOnline = computed(() => navigator.onLine);

// Computed: Urgency indicator class
const urgencyIndicatorClass = computed(() => {
  switch (urgencyLevel.value) {
    case "high":
      return "bg-error animate-pulse";
    case "medium":
      return "bg-warning";
    case "low":
      return "bg-info";
    default:
      return "bg-success";
  }
});

// Computed: Card styling based on urgency
const cardClasses = computed(() => {
  // if (urgencyLevel.value === "high") {
  //   return "border-error/20 dark:border-error";
  // }
  return "";
});

onMounted(() => {
  window.addEventListener("refresh-review-stats", refresh);
});

onUnmounted(() => {
  window.removeEventListener("refresh-review-stats", refresh);
});

</script>
