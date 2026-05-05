<template>
  <FeatureNotesSearch v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureNotesSearch from "~/features/notes/components/NotesSearch.vue";

const FeatureNotesSearch = RawFeatureNotesSearch as Component;
</script>
