<template>
  <FeatureMathNoteEditor v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureMathNoteEditor from "~/features/notes/components/MathNoteEditor.vue";

const FeatureMathNoteEditor = RawFeatureMathNoteEditor as Component;
</script>
