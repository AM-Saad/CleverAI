<script setup lang="ts">
import { useAuth } from "#imports";

const { status, data, signOut, signIn } = useAuth();

const handleLogout = async () => {
  try {
    await signOut({ redirect: false });
    window.location.href = "/logout";
  } catch (error) {
    console.error("Logout error:", error);
    window.location.href = "/logout";
  }
};
</script>

<template>
  <UiPanel variant="surface" size="md" class-name="mx-auto w-full max-w-5xl rounded-t shadow-[var(--shadow-modal)]">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <img v-if="status === 'authenticated' && data?.user?.image" class="h-12 w-12 rounded-full"
          :src="data.user.image" alt="User Avatar" />
        <h1 v-if="status === 'authenticated'" class="text-lg">
          Authenticated as {{ data?.user?.name }}!
        </h1>
        <h1 v-else>Not logged in</h1>
      </div>
      <UiButton v-if="status === 'authenticated'"
        tone="error"
        size="md"
        @click="signOut({ callbackUrl: '/logout' })">
        <span>Logout</span>
      </UiButton>
      <UiButton v-else
        tone="success"
        size="md"
        @click="signIn('')">
        <i class="fa fa-right-to-bracket pt-0.5" />
        <span>Login</span>
      </UiButton>
    </div>
  </UiPanel>
</template>
