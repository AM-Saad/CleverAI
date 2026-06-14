<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="shrink-0 px-4 py-3 border-b border-secondary flex items-center gap-3">
      <NuxtLink to="/language" class="text-content-secondary hover:text-primary transition-colors">
        <Icon name="i-lucide-arrow-left" class="w-5 h-5" />
      </NuxtLink>
      <div>
        <ui-subtitle size="base" color="content-on-surface">Language Review</ui-subtitle>
      </div>
    </div>

    <language-session-view class="flex-1 min-h-0" />
  </div>
</template>

<script setup lang="ts">
import LanguageSessionView from "~/features/language-learning/components/LanguageSessionView.vue";
</script>
