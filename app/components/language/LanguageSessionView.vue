<template>
  <FeatureLanguageSessionView v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureLanguageSessionView from "~/features/language-learning/components/LanguageSessionView.vue";

const FeatureLanguageSessionView = RawFeatureLanguageSessionView as Component;
</script>
