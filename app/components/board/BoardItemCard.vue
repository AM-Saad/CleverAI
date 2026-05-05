<template>
  <FeatureBoardItemCard v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardItemCard from "~/features/board/components/BoardItemCard.vue";

const FeatureBoardItemCard = RawFeatureBoardItemCard as Component;
</script>
