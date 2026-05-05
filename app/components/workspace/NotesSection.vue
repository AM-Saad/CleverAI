<template>
  <FeatureNotesSection v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureNotesSection from "~/features/notes/containers/NotesSection.vue";

const FeatureNotesSection = RawFeatureNotesSection as Component;
</script>
