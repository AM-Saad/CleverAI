<template>
  <FeatureStoryCard v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureStoryCard from "~/features/language-learning/components/StoryCard.vue";

const FeatureStoryCard = RawFeatureStoryCard as Component;
</script>
