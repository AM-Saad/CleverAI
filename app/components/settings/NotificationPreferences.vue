<template>
  <FeatureNotificationPreferences v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureNotificationPreferences from "~/features/notifications/components/NotificationPreferences.vue";

const FeatureNotificationPreferences = RawFeatureNotificationPreferences as Component;
</script>
