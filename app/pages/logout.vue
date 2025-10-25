<template>
  <div class="flex items-center justify-center  gap-2">
    <div class="text-center">
      <ui-title class="mb-2">Logged Out</ui-title>
      <ui-paragraph class="mb-4">
        You have been successfully logged out.
      </ui-paragraph>
      <div class="mt-4">
        <router-link to="/auth/signin">
          <u-button>
            Sign In Again
          </u-button>
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
