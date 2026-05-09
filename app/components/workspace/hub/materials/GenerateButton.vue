<template>
  <FeatureGenerateButton v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureGenerateButton from "~/features/materials/components/GenerateButton.vue";

const FeatureGenerateButton = RawFeatureGenerateButton as Component;
</script>
