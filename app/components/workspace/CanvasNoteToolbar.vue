<template>
  <FeatureCanvasNoteToolbar v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureCanvasNoteToolbar from "~/features/notes/components/CanvasNoteToolbar.vue";

const FeatureCanvasNoteToolbar = RawFeatureCanvasNoteToolbar as Component;
</script>
