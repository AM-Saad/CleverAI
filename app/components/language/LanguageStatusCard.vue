<template>
  <ui-card class="transition-all duration-200 shrink-0" :variant="minimal ? 'ghost' : 'default'"
    :size="minimal ? 'xs' : 'sm'">
    <template v-if="!minimal" #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <Icon name="i-lucide-languages" class="w-4 h-4 text-primary" />
          Language Review
        </div>
        <u-button size="xs" variant="ghost" :is-loading="isLoading" @click="refresh">
          <Icon name="heroicons:arrow-path" :class="['w-4 h-4', isLoading ? 'animate-spin' : '']" />
        </u-button>
      </div>
    </template>

    <ui-loader v-if="isLoading" :is-fetching="isLoading" />

    <shared-error-message v-if="error && !isLoading" :error="error" />

    <!-- Empty: nothing enrolled yet -->
    <div v-if="!isLoading && !error && totalEnrolled === 0"
      :class="`text-center ${minimal ? 'flex items-center gap-2' : ''}`">
      <Icon name="i-lucide-book-open" class="text-content-disabled w-5 h-5" />
      <ui-paragraph size="xs">No words enrolled yet. Capture a word to get started.</ui-paragraph>
    </div>

    <!-- Stats -->
    <div v-if="!isLoading && !error && totalEnrolled > 0"
      :class="`flex flex-col md:flex-row items-start md:items-center gap-3 ${minimal ? '' : ''}`">
      <div class="flex items-center justify-between w-full flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <div :class="['w-2.5 h-2.5 rounded-full', hasDueCards ? 'bg-error animate-pulse' : 'bg-success']" />
          <ui-paragraph size="base">
            {{ hasDueCards ? `${stats!.due} word${stats!.due === 1 ? '' : 's'} due` : 'All caught up!' }}
          </ui-paragraph>
        </div>
        <u-button v-if="hasDueCards" to="/language/review" size="sm">
          <Icon name="i-lucide-play" class="w-3.5 h-3.5 mr-1" />
          Start Session
          <span class="opacity-75 ml-1">({{ stats!.due }})</span>
        </u-button>
      </div>

      <div v-if="!minimal" class="flex gap-1.5 flex-wrap">
        <u-badge variant="soft" color="error">
          <span class="text-error text-xs">Due: {{ stats?.due ?? 0 }}</span>
        </u-badge>
        <u-badge variant="soft" color="primary">
          <span class="text-primary text-xs">Enrolled: {{ stats?.enrolled ?? 0 }}</span>
        </u-badge>
        <u-badge variant="soft" color="success">
          <span class="text-success text-xs">Mastered: {{ stats?.mastered ?? 0 }}</span>
        </u-badge>
      </div>
    </div>
  </ui-card>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  minimal?: boolean;
}>(), {
  minimal: false,
});

const { stats, isLoading, error, hasDueCards, totalEnrolled, refresh } = useLanguageStats();
</script>
