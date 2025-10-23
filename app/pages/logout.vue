<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <h1 class="text-2xl font-bold mb-4">Signing out...</h1>
      <p class="text-gray-600">You have been signed out successfully.</p>
      <div class="mt-4">
        <router-link
          to="/auth/signin"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Sign In Again
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  auth: false, // Allow access without authentication
});
</script>
