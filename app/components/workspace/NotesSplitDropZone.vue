<template>
  <FeatureNotesSplitDropZone v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureNotesSplitDropZone from "~/features/notes/components/NotesSplitDropZone.vue";

const FeatureNotesSplitDropZone = RawFeatureNotesSplitDropZone as Component;
</script>
