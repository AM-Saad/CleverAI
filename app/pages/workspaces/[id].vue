<template>
  <div class="workspace-overview-redirect p-4">
    <UiSkeleton class="h-12 w-full rounded-[var(--radius-lg)]" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";

const route = useRoute();
const { setActive } = useActiveWorkspace();

definePageMeta({ middleware: "auth" });

onMounted(() => {
  const id = String(route.params.id);
  if (id) {
    setActive(id);
  }
  navigateTo("/learn", { replace: true });
});
</script>
