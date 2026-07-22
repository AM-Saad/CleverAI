<template>
  <nav class="ds-tabbar" aria-label="Primary">
    <NuxtLink
      v-for="item in items"
      :key="item.label"
      :to="item.to"
      class="ds-tab"
      :class="{ 'ds-tab--active': isActive(item.path) }"
      :aria-current="isActive(item.path) ? 'page' : undefined"
    >
      <UiIcon :name="item.icon" class="ds-tab__icon" />
      <span class="ds-tab__label">{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();
const items = computed(() => {
  const context = route.path.startsWith("/day")
    ? "daily"
    : ["/learn", "/language", "/materials", "/review", "/workspaces"].some(
          (path) => route.path === path || route.path.startsWith(`${path}/`),
        )
      ? "learning"
      : route.query.app === "daily" || route.query.app === "learning"
        ? route.query.app
        : null;
  const accountTo = context
    ? {
        path: "/account",
        query: {
          app: context,
          returnTo:
            route.path.startsWith("/account") &&
            typeof route.query.returnTo === "string"
              ? route.query.returnTo
              : route.fullPath,
        },
      }
    : "/account";

  return [
    { path: "/", to: "/", label: "Apps", icon: "i-lucide-layout-grid" },
    {
      path: "/day",
      to: "/day",
      label: "Daily",
      icon: "i-lucide-calendar-check-2",
    },
    {
      path: "/learn",
      to: "/learn",
      label: "Learning",
      icon: "i-lucide-graduation-cap",
    },
    {
      path: "/account",
      to: accountTo,
      label: "Account",
      icon: "i-lucide-user-round",
    },
  ];
});

function isActive(to: string) {
  if (to === "/") return route.path === "/";
  if (to === "/day") return route.path.startsWith("/day");
  if (to === "/learn") {
    return (
      route.path.startsWith("/learn") ||
      route.path.startsWith("/language") ||
      route.path.startsWith("/materials") ||
      route.path.startsWith("/review") ||
      route.path.startsWith("/workspaces")
    );
  }
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
  grid-template-columns: repeat(4, 1fr);
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

@media (prefers-reduced-motion: reduce) {
  .ds-tab {
    transition: none;
  }
}
</style>
