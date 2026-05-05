<template>
  <FeatureLanguageStatusCard v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureLanguageStatusCard from "~/features/language-learning/components/LanguageStatusCard.vue";

const FeatureLanguageStatusCard = RawFeatureLanguageStatusCard as Component;
</script>
