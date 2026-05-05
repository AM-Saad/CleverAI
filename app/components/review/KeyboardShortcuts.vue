<template>
  <FeatureKeyboardShortcuts v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureKeyboardShortcuts from "~/features/review/components/KeyboardShortcuts.vue";

const FeatureKeyboardShortcuts = RawFeatureKeyboardShortcuts as Component;
</script>
