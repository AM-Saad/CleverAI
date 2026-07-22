<template>
  <div class="ds-shell">
    <a href="#main-content" class="ds-skip">Skip to main content</a>

    <div class="ds-shell__frame" :class="{ 'ds-shell__frame--wide': isMarketingLanding }">
      <main id="main-content" tabindex="-1" class="ds-shell__main" :class="{ 'ds-shell__main--tabbar': showChrome }">
        <ServiceWorkerUpdateNotification mode="banner" />
        <slot />
      </main>

      <template v-if="showChrome">
        <MobileTabBar />
      </template>

      <!-- Global quick-switch (opened from any scoped screen's workspace pill). -->
      <WorkspaceSwitcherSheet v-if="hasAppAccess && isLearningRoute && !isBareRoute" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MobileTabBar from "~/components/shell/MobileTabBar.vue";
import WorkspaceSwitcherSheet from "~/components/shell/WorkspaceSwitcherSheet.vue";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

const { status } = useAuth();
const offline = useOfflineRuntime();
const route = useRoute();

// Chrome (tab bar + capture) only for the authenticated app — auth/marketing
// routes render the bare page.
const isBareRoute = computed(
  () =>
    route.path.startsWith("/auth") ||
    route.path.startsWith("/about") ||
    route.path.startsWith("/pricing"),
);
// Immersive flows hide the tab bar + capture FAB so their own bottom controls
// (review grade bar, note format bar) own the bottom edge.
const isImmersiveRoute = computed(
  () =>
    route.path === "/review" ||
    route.path === "/language/review" ||
    /^\/notes\/[^/]+$/.test(route.path) ||
    /^\/board\/[^/]+$/.test(route.path),
);
const hasAppAccess = computed(
  () =>
    status.value === "authenticated" ||
    (!offline.isOnline.value && Boolean(offline.accountId.value)),
);
const showChrome = computed(
  () => hasAppAccess.value && !isBareRoute.value && !isImmersiveRoute.value,
);
const isLearningRoute = computed(() =>
  ["/learn", "/language", "/materials", "/review", "/workspaces"].some(
    (path) => route.path === path || route.path.startsWith(`${path}/`),
  ),
);
// The signed-out home is the full-width marketing landing, not the phone column.
const isMarketingLanding = computed(
  () =>
    route.path === "/" &&
    status.value === "unauthenticated" &&
    !hasAppAccess.value,
);
</script>

<style scoped>
.ds-shell {
  height: calc(100svh - calc(74px + env(safe-area-inset-bottom)));
  background: var(--color-background);
  color: var(--color-content-on-background);
  display: flex
}

/* Mobile-first column, centered on wider viewports so the PWA reads as a phone
   app at all widths (full-replacement design). */
.ds-shell__frame {
  position: relative;
  margin: 0 auto;
  width: 100%;
  max-width: 680px;
  flex-grow: 1;
  display: flex;
}

.ds-shell__frame--wide {
  max-width: none;
}

.ds-shell__main {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  padding: var(--space-2);
}

.ds-shell__main--tabbar {
  padding-bottom: calc(74px + env(safe-area-inset-bottom));
}

.ds-skip {
  position: absolute;
  left: -9999px;
}

.ds-skip:focus {
  left: var(--space-4);
  top: var(--space-4);
  z-index: var(--z-tooltip);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 600;
}
</style>
