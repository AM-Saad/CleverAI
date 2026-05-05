<template>
  <FeatureCanvasNoteEditor v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureCanvasNoteEditor from "~/features/notes/components/CanvasNoteEditor.vue";

const FeatureCanvasNoteEditor = RawFeatureCanvasNoteEditor as Component;
</script>
