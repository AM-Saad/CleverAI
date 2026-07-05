<template>
  <div class="ds-shell">
    <a href="#main-content" class="ds-skip">Skip to main content</a>

    <div
      class="ds-shell__frame"
      :class="{ 'ds-shell__frame--wide': isMarketingLanding }"
    >
      <main
        id="main-content"
        tabindex="-1"
        class="ds-shell__main"
        :class="{ 'ds-shell__main--tabbar': showChrome }"
      >
        <ServiceWorkerUpdateNotification mode="banner" />
        <slot />
      </main>

      <template v-if="showChrome">
        <MobileTabBar
          :capture-open="captureOpen"
          @capture="captureOpen = true"
        />
        <CaptureSheet v-model:open="captureOpen" @select="onCapture" />
      </template>

      <!-- Global quick-switch (opened from any scoped screen's workspace pill). -->
      <WorkspaceSwitcherSheet v-if="status === 'authenticated'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileTabBar from "~/components/shell/MobileTabBar.vue";
import CaptureSheet from "~/components/shell/CaptureSheet.vue";
import WorkspaceSwitcherSheet from "~/components/shell/WorkspaceSwitcherSheet.vue";

const { status } = useAuth();
const route = useRoute();
const { setActive } = useActiveWorkspace();

const captureOpen = ref(false);
const captureRequest = ref(0);
type CaptureAction = "note" | "word" | "upload" | "ai" | "dictate";
type CaptureSelection = { key: CaptureAction; workspaceId: string | null };

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
  () => route.path === "/review" || /^\/notes\/[^/]+$/.test(route.path),
);
const showChrome = computed(
  () =>
    status.value === "authenticated" &&
    !isBareRoute.value &&
    !isImmersiveRoute.value,
);
// The signed-out home is the full-width marketing landing, not the phone column.
const isMarketingLanding = computed(
  () => route.path === "/" && status.value === "unauthenticated",
);

function nextCaptureToken() {
  captureRequest.value += 1;
  return String(captureRequest.value);
}

function commitWorkspaceTarget(payload: CaptureSelection) {
  if (payload.key === "word") return true;
  if (!payload.workspaceId) {
    void navigateTo("/workspaces?new=1");
    return false;
  }
  setActive(payload.workspaceId);
  return true;
}

function onCapture(payload: CaptureSelection) {
  if (!commitWorkspaceTarget(payload)) return;

  switch (payload.key) {
    case "note":
      return navigateTo({
        path: "/notes",
        query: { compose: "note", capture: nextCaptureToken() },
      });
    case "word":
      return navigateTo({
        path: "/language",
        query: { compose: "1", capture: nextCaptureToken() },
      });
    case "upload":
      return navigateTo({
        path: "/materials",
        query: { upload: "1", capture: nextCaptureToken() },
      });
    case "ai":
      return navigateTo({
        path: "/notes",
        query: { compose: "ai", capture: nextCaptureToken() },
      });
    case "dictate":
      return navigateTo({
        path: "/notes",
        query: { compose: "dictate", capture: nextCaptureToken() },
      });
  }
}
</script>

<style scoped>
.ds-shell {
  min-height: 100dvh;
  background: var(--color-background);
  color: var(--color-content-on-background);
}

/* Mobile-first column, centered on wider viewports so the PWA reads as a phone
   app at all widths (full-replacement design). */
.ds-shell__frame {
  position: relative;
  margin: 0 auto;
  width: 100%;
  max-width: 580px;
  min-height: 100dvh;
}

.ds-shell__frame--wide {
  max-width: none;
}

.ds-shell__main {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
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
