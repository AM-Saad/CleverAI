<template>
  <FeatureTranslatePanel v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureTranslatePanel from "~/features/language-learning/components/TranslatePanel.vue";

const FeatureTranslatePanel = RawFeatureTranslatePanel as Component;
</script>
