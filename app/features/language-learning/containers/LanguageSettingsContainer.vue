<template>
  <shared-page-wrapper
    title="Language Settings"
    subtitle="Configure your language learning preferences"
  >
    <div class="mt-6">
      <language-preferences-module />
    </div>
  </shared-page-wrapper>
</template>

<script setup lang="ts">
import LanguagePreferencesModule from "~/features/language-learning/components/LanguagePreferencesModule.vue";
</script>
