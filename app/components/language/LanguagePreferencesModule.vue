<template>
  <FeatureLanguagePreferencesModule v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureLanguagePreferencesModule from "~/features/language-learning/components/LanguagePreferencesModule.vue";

const FeatureLanguagePreferencesModule = RawFeatureLanguagePreferencesModule as Component;
</script>
