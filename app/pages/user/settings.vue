<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const route = useRoute();
const action = route.query.action;

if (action === "update-profile") {
  await navigateTo(
    { path: "/account/profile", query: { dialog: "profile" } },
    { replace: true },
  );
} else if (action === "change-password") {
  await navigateTo(
    { path: "/account/security", query: { dialog: "password" } },
    { replace: true },
  );
} else {
  await navigateTo({ path: "/account" }, { replace: true });
}
</script>
