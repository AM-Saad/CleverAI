<template>
  <ui-card :class="[
    'transition-all duration-200',
    cardClasses,
  ]" :variant="minimal ? 'ghost' : 'default'" :size="minimal ? 'xs' : 'sm'">
    <!-- Loading State -->
    <template #header v-if="!minimal">
      <div class="flex items-center justify-between w-full">
        Review Status
        <u-button v-if="showRefresh" size="xs" variant="ghost" :is-loading="isLoading" @click="refresh">
          <Icon name="heroicons:arrow-path" :class="['w-4 h-4', isLoading ? 'animate-spin' : '']" />
        </u-button>
      </div>
    </template>
    <ui-loader v-if="isLoading" :is-fetching="isLoading" />

    <!-- Error State -->
    <shared-error-message v-if="error && !isLoading" :error="error" :refresh="refresh" />


    <!-- Empty State (no cards enrolled) -->
    <div v-if="isEmpty && !isLoading && !error" :class="`text-center ${minimal ? 'flex items-center gap-2' : ''}`">
      <Icon name="heroicons:academic-cap" class="w-10 h-10 text-gray-400 " />
      <p class="text-gray-600 dark:text-gray-400">
        {{ emptyMessage }}
      </p>
      <slot name="empty-action" />
    </div>

    <!-- Stats Display -->
    <div v-if="!isLoading && !error && !isEmpty"
      :class="`text-center flex flex-col items-center md:flex-row gap-6 md:gap-0 ${minimal ? '' : ''}`">
      <!-- Header with status message -->
      <div class="flex items-center justify-between md:justify-start gap-2 w-full">
        <div class="flex items-center gap-2">
          <div :class="[minimal ? 'w-2 h-2' : 'w-3 h-3', 'rounded-full', urgencyIndicatorClass]" />
          <ui-paragraph size="base" color="neutral">
            {{ statusMessage }}
          </ui-paragraph>
        </div>

        <!-- Action Button -->
        <div v-if="showAction && hasDueCards">
          <u-button :to="reviewLink" color="primary" :size="minimal ? 'xs' : 'sm'">
            <Icon name="heroicons:play" class="w-4 h-4" />
            Start Review
            <span v-if="stats?.due" class=" opacity-75">({{ stats.due }})</span>
          </u-button>
        </div>

      </div>

      <!-- Stats Grid - Full variant for default/outline -->
      <div v-if="!minimal" class="flex md:justify-end justify-evenly gap-2 text-center w-full overflow-auto">
        <u-badge class="flex grid-1" variant="soft" color="error">
          <div class="text-red-700 dark:text-red-300">Due</div>

          <div class="text-red-600 dark:text-red-400">
            {{ stats?.due ?? 0 }}
          </div>
        </u-badge>
        <u-badge class="flex grid-1" variant="soft" color="primary">
          <div class="text-blue-700 dark:text-blue-300">New</div>

          <div class="text-blue-600 dark:text-blue-400">
            {{ stats?.new ?? 0 }}
          </div>
        </u-badge>
        <u-badge class="flex grid-1" variant="soft" color="warning">
          <div class="text-orange-700 dark:text-orange-300">Learning</div>

          <div class="text-orange-600 dark:text-orange-400">
            {{ stats?.learning ?? 0 }}
          </div>
        </u-badge>
        <u-badge class="flex grid-1" variant="soft" color="success">
          <div class="text-green-700 dark:text-green-300">Mature</div>

          <div class="text-green-600 dark:text-green-400">
            {{ stats?.mature ?? 0 }}
          </div>
        </u-badge>
      </div>


      <!-- Context info (folder name) if available -->
      <div v-if="stats?.context?.folderTitle && showContext"
        class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center text-sm text-gray-500">
          <Icon name="heroicons:folder" class="w-4 h-4 mr-1" />
          {{ stats.context.folderTitle }}
        </div>
      </div>
    </div>
  </ui-card>
</template>

<script setup lang="ts">
import type { ReviewSummaryStats } from "~/shared/utils/review.contract";

interface Props {
  /** Folder ID for folder-specific stats (omit for global) */
  folderId?: string;
  /** Pre-loaded stats (skip fetch if provided) */
  initialStats?: ReviewSummaryStats;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Show action button (Start Review) */
  showAction?: boolean;
  /** Show folder context info */
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
  folderId: undefined,
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
  hasDueCards,
  isEmpty,
  statusMessage,
  urgencyLevel,
  refresh,
} = useReviewStats({
  folderId: computed(() => props.folderId),
  immediate: !props.initialStats,
});

// If initial stats provided, use them
if (props.initialStats) {
  // @ts-expect-error - we're intentionally setting ref value
  stats.value = props.initialStats;
}

// Computed: Review link (with or without folder filter)
const reviewLink = computed(() => {
  const base = "/user/review";
  return props.folderId ? `${base}?folderId=${props.folderId}` : base;
});

// Computed: Urgency indicator class
const urgencyIndicatorClass = computed(() => {
  switch (urgencyLevel.value) {
    case "high":
      return "bg-red-500 animate-pulse";
    case "medium":
      return "bg-orange-500";
    case "low":
      return "bg-blue-500";
    default:
      return "bg-green-500";
  }
});

// Computed: Card styling based on urgency
const cardClasses = computed(() => {
  // if (urgencyLevel.value === "high") {
  //   return "border-red-200 dark:border-red-600";
  // }
  return "";
});
</script>
