<template>
  <FeatureGradeButtons v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureGradeButtons from "~/features/review/components/GradeButtons.vue";

const FeatureGradeButtons = RawFeatureGradeButtons as Component;
</script>
