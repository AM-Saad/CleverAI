<template>
  <FeatureBoardViewToggle v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardViewToggle from "~/features/board/components/BoardViewToggle.vue";

const FeatureBoardViewToggle = RawFeatureBoardViewToggle as Component;
</script>
