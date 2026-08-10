<template>
  <div class="learning-home">
    <LearningHome />
  </div>
</template>

<script setup lang="ts">
import LearningHome from "~/features/learning-shell/components/LearningHome.vue";

definePageMeta({ middleware: "auth" });
</script>
