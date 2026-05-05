<template>
  <LanguageHomeContainer />
</template>

<script setup lang="ts">
import LanguageHomeContainer from "~/features/language-learning/containers/LanguageHomeContainer.vue";

definePageMeta({ middleware: "auth" });
</script>
