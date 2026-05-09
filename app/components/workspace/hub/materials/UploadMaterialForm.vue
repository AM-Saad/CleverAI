<template>
  <FeatureUploadMaterialForm v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureUploadMaterialForm from "~/features/materials/components/UploadMaterialForm.vue";

const FeatureUploadMaterialForm = RawFeatureUploadMaterialForm as Component;
</script>
