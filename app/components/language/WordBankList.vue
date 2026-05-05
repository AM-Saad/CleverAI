<template>
  <FeatureWordBankList v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureWordBankList from "~/features/language-learning/components/WordBankList.vue";

const FeatureWordBankList = RawFeatureWordBankList as Component;
</script>
