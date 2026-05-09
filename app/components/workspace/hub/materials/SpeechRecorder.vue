<template>
  <FeatureSpeechRecorder v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureSpeechRecorder from "~/features/materials/components/SpeechRecorder.vue";

const FeatureSpeechRecorder = RawFeatureSpeechRecorder as Component;
</script>
