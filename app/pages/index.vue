<template>
  <!-- `/` serves both audiences: the public marketing landing when signed out,
       the Today hub when signed in. Each side is its own component so its data
       fetching only runs under the matching auth state. -->
  <LandingHome v-if="status === 'unauthenticated' && !hasAppAccess" />
  <AppLauncher v-else-if="hasAppAccess" />
</template>

<script setup lang="ts">
import LandingHome from "~/components/landing/LandingHome.vue";
import AppLauncher from "~/components/home/AppLauncher.vue";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

const { status } = useAuth();
const offline = useOfflineRuntime();
const hasAppAccess = computed(
  () =>
    status.value === "authenticated" ||
    (!offline.isOnline.value && Boolean(offline.accountId.value)),
);

// Public route: the middleware must not redirect signed-out visitors to /auth.
definePageMeta({ auth: false, name: "home" });
</script>
