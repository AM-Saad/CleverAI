<template>
  <FeatureQuickCaptureButton v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureQuickCaptureButton from "~/features/language-learning/components/QuickCaptureButton.vue";

const FeatureQuickCaptureButton = RawFeatureQuickCaptureButton as Component;
</script>
