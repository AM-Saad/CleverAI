<template>
  <FeatureMaterialsList v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureMaterialsList from "~/features/materials/components/MaterialsList.vue";

const FeatureMaterialsList = RawFeatureMaterialsList as Component;
</script>
