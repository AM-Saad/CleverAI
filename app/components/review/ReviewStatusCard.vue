<template>
  <ui-card :class="[
    'transition-all duration-200',
    cardClasses,
  ]" :variant="variant">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-4">
      <!-- <Loading size="sm" /> -->
      <span class="ml-2 text-gray-500">Loading review stats...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-4">
      <Icon name="heroicons:exclamation-triangle" class="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p class="text-red-600 text-sm">{{ error.message }}</p>
      <u-button size="xs" variant="ghost" class="mt-2" @click="refresh">
        Retry
      </u-button>
    </div>

    <!-- Empty State (no cards enrolled) -->
    <div v-else-if="isEmpty" :class="`text-center py-4 ${variant === 'ghost' ? 'flex items-center gap-2' : ''}`">
      <Icon name="heroicons:academic-cap" class="w-10 h-10 text-gray-400 " />
      <p class="text-gray-600 dark:text-gray-400">
        {{ emptyMessage }}
      </p>
      <slot name="empty-action" />
    </div>

    <!-- Stats Display -->
    <div v-else :class="`text-center py-4 ${variant === 'ghost' ? 'flex items-center gap-2' : ''}`">
      <!-- Header with status message -->
      <div class="flex items-center justify-between" :class="[variant === 'ghost' ? '' : 'mb-4']">
        <div class="flex items-center gap-2">
          <div :class="[variant === 'ghost' ? 'w-2 h-2' : 'w-3 h-3', 'rounded-full', urgencyIndicatorClass]" />
          <span
            :class="[variant === 'ghost' ? ' text-gray-600 dark:text-gray-400' : 'font-medium text-gray-900 dark:text-gray-100']">
            {{ statusMessage }}
          </span>
        </div>
        <u-button v-if="showRefresh" size="xs" variant="ghost" @click="refresh" :disabled="isLoading">
          <Icon name="heroicons:arrow-path" class="w-4 h-4" />
        </u-button>
      </div>

      <!-- Stats Grid - Minimal variant for ghost -->
      <!-- <div  class="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
        <div v-if="stats?.due" class="flex items-center gap-1">
          <span class="font-semibold text-red-600 dark:text-red-400">{{ stats.due }}</span>
          <span>due</span>
        </div>
        <div v-if="stats?.new" class="flex items-center gap-1">
          <span class="font-semibold text-blue-600 dark:text-blue-400">{{ stats.new }}</span>
          <span>new</span>
        </div>
        <div v-if="stats?.learning" class="flex items-center gap-1">
          <span class="font-semibold text-orange-600 dark:text-orange-400">{{ stats.learning }}</span>
          <span>learning</span>
        </div>
        <div v-if="stats?.mature" class="flex items-center gap-1">
          <span class="font-semibold text-green-600 dark:text-green-400">{{ stats.mature }}</span>
          <span>mature</span>
        </div>
      </div> -->

      <!-- Stats Grid - Full variant for default/outline -->
      <div v-if="variant !== 'ghost'" class="grid grid-cols-4 gap-2 text-center">
        <div class="p-1 rounded bg-red-50 dark:bg-red-900/20">
          <div class="text-lg font-bold text-red-600 dark:text-red-400">
            {{ stats?.due ?? 0 }}
          </div>
          <div class="text-xs text-red-700 dark:text-red-300">Due</div>
        </div>
        <div class="p-1 rounded bg-blue-50 dark:bg-blue-900/20">
          <div class="text-lg font-bold text-blue-600 dark:text-blue-400">
            {{ stats?.new ?? 0 }}
          </div>
          <div class="text-xs text-blue-700 dark:text-blue-300">New</div>
        </div>
        <div class="p-1 rounded bg-orange-50 dark:bg-orange-900/20">
          <div class="text-lg font-bold text-orange-600 dark:text-orange-400">
            {{ stats?.learning ?? 0 }}
          </div>
          <div class="text-xs text-orange-700 dark:text-orange-300">Learning</div>
        </div>
        <div class="p-1 rounded bg-green-50 dark:bg-green-900/20">
          <div class="text-lg font-bold text-green-600 dark:text-green-400">
            {{ stats?.mature ?? 0 }}
          </div>
          <div class="text-xs text-green-700 dark:text-green-300">Mature</div>
        </div>
      </div>

      <!-- Action Button -->
      <div v-if="showAction && hasDueCards" :class="[variant === 'ghost' ? '' : 'mt-4']">
        <u-button :to="reviewLink" color="primary" :size="compact || variant === 'ghost' ? 'xs' : 'md'">
          <Icon name="heroicons:play" class="w-4 h-4" />
          Start Review
          <span v-if="stats?.due" class=" opacity-75">({{ stats.due }})</span>
        </u-button>
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
  if (urgencyLevel.value === "high") {
    return "border-red-200 dark:border-red-800";
  }
  return "";
});
</script>
