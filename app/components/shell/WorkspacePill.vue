<template>
  <UiPill
    v-if="activeWorkspace"
    clickable
    variant="ghost"
    :label="activeWorkspace.title"
    :color="accent"
    class-name="wpill"
    @click="openSwitcher"
  >
    <UiAnimatedText :text="activeWorkspace.title" />

    <template #indicator>
      <UiPillIndicator :color="accent" />
    </template>
    <template #icon>
      <UiPillIcon name="chevron-down" />
    </template>
  </UiPill>

  <UiPill
    v-else-if="loading"
    variant="ghost"
    class-name="wpill wpill--loading"
    max-width="132px"
    role="status"
    aria-label="Loading workspace"
  >
    <UiSkeleton shape="text" width="76px" height="12px" />

    <template #indicator>
      <UiSkeleton shape="circle" width="8px" height="8px" />
    </template>
    <template #icon>
      <UiSkeleton shape="circle" width="14px" height="14px" />
    </template>
  </UiPill>
</template>

<script setup lang="ts">
/**
 * WorkspacePill — compact "you are here" workspace affordance for scoped-screen
 * headers. Shows the active space (accent dot + name) and opens the global
 * quick-switch sheet on tap.
 */
import { computed } from "vue";
import { accentVarFor } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";

const { activeWorkspace, loading, openSwitcher } = useActiveWorkspace();

const accent = computed(() => {
  const w = activeWorkspace.value;
  if (!w) return "var(--color-accent-indigo)";
  const meta = w.metadata as Record<string, unknown> | null;
  if (typeof meta?.color === "string" && meta.color.startsWith("--"))
    return `var(${meta.color})`;
  return accentVarFor(w.id);
});
</script>

<style scoped>
:deep(.wpill--loading) {
  width: 132px;
  pointer-events: none;
}
</style>
