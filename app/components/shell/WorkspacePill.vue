<template>
  <UiPill
    v-if="activeWorkspace"
    clickable
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
      <UiPillIcon name="i-lucide-chevron-down" />
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

const { activeWorkspace, openSwitcher } = useActiveWorkspace();

const accent = computed(() => {
  const w = activeWorkspace.value;
  if (!w) return "var(--color-accent-indigo)";
  const meta = w.metadata as Record<string, unknown> | null;
  if (typeof meta?.color === "string" && meta.color.startsWith("--"))
    return `var(${meta.color})`;
  return accentVarFor(w.id);
});
</script>
