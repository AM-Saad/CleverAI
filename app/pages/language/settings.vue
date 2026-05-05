<template>
  <LanguageSettingsContainer />
</template>

<script setup lang="ts">
import LanguageSettingsContainer from "~/features/language-learning/containers/LanguageSettingsContainer.vue";

definePageMeta({ middleware: "auth" });
</script>
