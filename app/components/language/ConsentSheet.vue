<template>
  <FeatureConsentSheet v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureConsentSheet from "~/features/language-learning/components/ConsentSheet.vue";

const FeatureConsentSheet = RawFeatureConsentSheet as Component;
</script>
