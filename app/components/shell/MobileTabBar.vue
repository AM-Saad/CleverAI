<template>
  <nav class="ds-tabbar" aria-label="Primary">
    <NuxtLink
      v-for="item in leftItems"
      :key="item.to"
      :to="item.to"
      class="ds-tab"
      :class="{ 'ds-tab--active': isActive(item.to) }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <UiIcon :name="item.icon" class="ds-tab__icon" />
      <span class="ds-tab__label">{{ item.label }}</span>
    </NuxtLink>

    <!-- Center capture FAB, raised above the bar -->
    <button type="button" class="ds-fab" :class="{ 'ds-fab--open': captureOpen }" aria-label="Capture" @click="emit('capture')"> <!-- design-allow: shell chrome, native gradient FAB -->
      <UiIcon name="i-lucide-plus" class="ds-fab__icon" />
    </button>

    <NuxtLink
      :to="materialsItem.to"
      class="ds-tab"
      :class="{ 'ds-tab--active': isActive(materialsItem.to) }"
      :aria-current="isActive(materialsItem.to) ? 'page' : undefined"
    >
      <UiIcon :name="materialsItem.icon" class="ds-tab__icon" />
      <span class="ds-tab__label">{{ materialsItem.label }}</span>
    </NuxtLink>

    <button type="button" class="ds-tab" :class="{ 'ds-tab--active': isMoreActive }" :aria-expanded="moreOpen" @click="moreOpen = true"> <!-- design-allow: shell tab action opens app destination sheet -->
      <UiIcon name="i-lucide-ellipsis" class="ds-tab__icon" />
      <span class="ds-tab__label">More</span>
    </button>
  </nav>

  <UiSheet :open="moreOpen" title="More" @update:open="moreOpen = $event">
    <div class="ds-more">
      <UiListCard
        v-for="item in moreItems"
        :key="item.to"
        :to="item.to"
        size="lg"
        :title="item.label"
        :description="item.hint"
        :selected="isActive(item.to)"
        :leading-color="item.color"
        @click="moreOpen = false"
      >
        <template #leading>
          <UiIcon :name="item.icon" class="h-5 w-5" aria-hidden="true" />
        </template>
        <template #action>
          <UiIcon
            name="i-lucide-chevron-right"
            class="h-4 w-4"
            aria-hidden="true"
          />
        </template>
      </UiListCard>
    </div>
  </UiSheet>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";

defineProps<{ captureOpen?: boolean }>();
const emit = defineEmits<{ (e: "capture"): void }>();

const route = useRoute();
const moreOpen = ref(false);

const leftItems = [
  { to: "/", label: "Home", icon: "i-lucide-house" },
  { to: "/notes", label: "Notes", icon: "i-lucide-file-text" },
];
const materialsItem = {
  to: "/materials",
  label: "Materials",
  icon: "i-lucide-file-stack",
};
const moreItems = [
  {
    to: "/review",
    label: "Review",
    hint: "Spaced repetition queue",
    icon: "i-lucide-square-stack",
    color: "var(--color-primary)",
  },
  {
    to: "/board",
    label: "Board",
    hint: "Workspace task board",
    icon: "i-lucide-kanban",
    color: "var(--color-accent-blue)",
  },
  {
    to: "/language",
    label: "Language",
    hint: "Global word bank and translation",
    icon: "i-lucide-languages",
    color: "var(--color-accent-teal)",
  },
  {
    to: "/workspaces",
    label: "Workspaces",
    hint: "Manage all workspaces",
    icon: "i-lucide-folder-kanban",
    color: "var(--color-accent-indigo)",
  },
  {
    to: "/account",
    label: "Account",
    hint: "Settings and preferences",
    icon: "i-lucide-user-round",
    color: "var(--color-content-secondary)",
  },
];

const isMoreActive = computed(() =>
  moreItems.some((item) => isActive(item.to)),
);

function isActive(to: string) {
  if (to === "/") return route.path === "/";
  return route.path === to || route.path.startsWith(to + "/");
}
</script>

<style scoped>
.ds-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-drawer);
  height: calc(74px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  background: var(--color-background);
  border-top: 1px solid var(--color-secondary);
}
.ds-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: var(--target-touch);
  color: var(--color-content-disabled);
  transition: color var(--duration-fast) var(--ease-standard);
}
.ds-tab__icon {
  width: 22px;
  height: 22px;
}
.ds-tab__label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.ds-tab--active {
  color: var(--color-primary);
}

.ds-fab {
  justify-self: center;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-top: -28px;
  border-radius: var(--radius-full);
  background: var(--ds-gradient-fab);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-primary-glow);
  outline: 4px solid var(--color-background);
  transition: transform var(--duration-normal) var(--ease-emphasized);
}
.ds-fab:active {
  transform: scale(0.94);
}
.ds-fab--open {
  transform: scale(0.9) rotate(45deg);
}
.ds-fab__icon {
  width: 26px;
  height: 26px;
}
.ds-more {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
@media (prefers-reduced-motion: reduce) {
  .ds-fab,
  .ds-tab {
    transition: none;
  }
}
</style>
