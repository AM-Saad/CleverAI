<template>
  <FeatureAnswerRevealButton v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureAnswerRevealButton from "~/features/review/components/AnswerRevealButton.vue";

const FeatureAnswerRevealButton = RawFeatureAnswerRevealButton as Component;
</script>
