<template>
  <FeatureNotificationSubscriptionModal v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureNotificationSubscriptionModal from "~/features/notifications/components/NotificationSubscriptionModal.vue";

const FeatureNotificationSubscriptionModal = RawFeatureNotificationSubscriptionModal as Component;
</script>
