<template>
  <FeatureQuickCaptureModal v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureQuickCaptureModal from "~/features/language-learning/components/QuickCaptureModal.vue";

const FeatureQuickCaptureModal = RawFeatureQuickCaptureModal as Component;
</script>
