<template>
  <!-- `/` serves both audiences: the public marketing landing when signed out,
       the Today hub when signed in. Each side is its own component so its data
       fetching only runs under the matching auth state. -->
  <LandingHome v-if="status === 'unauthenticated'" />
  <HomeHub v-else-if="status === 'authenticated'" />
</template>

<script setup lang="ts">
import LandingHome from "~/components/landing/LandingHome.vue";
import HomeHub from "~/components/home/HomeHub.vue";

const { status } = useAuth();

// Public route: the middleware must not redirect signed-out visitors to /auth.
definePageMeta({ auth: false, name: "home" });
</script>
