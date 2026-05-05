<template>
  <FeatureTextNote v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureTextNote from "~/features/notes/components/TextNote.vue";

const FeatureTextNote = RawFeatureTextNote as Component;
</script>
