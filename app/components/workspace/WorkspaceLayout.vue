<script setup lang="ts">
import { useWorkspaceLayout, type PanelId } from "~/composables/ui/useWorkspaceLayout";
import { useResponsive } from "~/composables/ui/useResponsive";

const props = defineProps<{
  workspaceId: string;
}>();

const { isDesktop } = useResponsive();

const {
  PANELS,
  COLLAPSED_WIDTH_PX,
  panelSizes,
  collapsedPanels,
  activeTab,
  isResizing,
  isAnimating,
  containerRef,
  panelStyles,
  toggleCollapse,
  isCollapsed,
  startResize,
  setActiveTab,
} = useWorkspaceLayout(props.workspaceId);

// ─── Mobile: explicit tab switching (no swipe) ───────────────────
const activePanelIndex = computed(() => {
  const index = PANELS.findIndex((panel) => panel.id === activeTab.value);
  return index === -1 ? 0 : index;
});

function scrollToTab(tab: PanelId) {
  setActiveTab(tab);
}

// ─── Desktop: Collapse button helpers ───────────────────────────
function getCollapseIcon(panelId: PanelId): string {
  const idx = PANELS.findIndex((p) => p.id === panelId);
  if (isCollapsed(panelId)) {
    // Show expand direction
    return idx === 0 ? "i-lucide-chevron-right" : idx === 2 ? "i-lucide-chevron-left" : "i-lucide-chevrons-left";
  }
  // Show collapse direction
  return idx === 0 ? "i-lucide-chevron-left" : idx === 2 ? "i-lucide-chevron-right" : "i-lucide-chevrons-right";
}

function getPanelIcon(panelId: PanelId): string {
  return PANELS.find((p) => p.id === panelId)?.icon ?? "i-lucide-layout";
}

function getPanelLabel(panelId: PanelId): string {
  return PANELS.find((p) => p.id === panelId)?.label ?? "";
}

// Expose for parent to use
defineExpose({
  scrollToTab,
  setActiveTab,
  activeTab,
});
</script>

<template>
  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- DESKTOP LAYOUT: 3 resizable panels with drag handles          -->
  <!-- ═══════════════════════════════════════════════════════════════ -->
  <div v-if="isDesktop" ref="containerRef" class="workspace-layout-desktop"
    :class="{ 'is-resizing': isResizing, 'is-animating': isAnimating }">
    <template v-for="(panel, index) in PANELS" :key="panel.id">
      <!-- Panel -->
      <div class="workspace-panel" :class="[
        `panel-${panel.id}`,
        { 'is-collapsed': isCollapsed(panel.id) },
      ]" :style="panelStyles[index]">
        <!-- Collapsed strip -->
        <div v-if="isCollapsed(panel.id)" class="collapsed-strip" @click="toggleCollapse(panel.id)">
          <div class="collapsed-strip-content">
            <u-icon :name="getPanelIcon(panel.id)" class="collapsed-icon" />
            <span class="collapsed-label">{{ getPanelLabel(panel.id) }}</span>
          </div>
          <u-icon :name="getCollapseIcon(panel.id)" class="collapsed-expand-icon" />
        </div>

        <!-- Panel content (visible when not collapsed) -->
        <div v-else class="workspace-panel-inner">
          <!-- Collapse button overlay -->
          <button class="collapse-btn" :class="`collapse-btn-${panel.id}`" :title="`Collapse ${panel.label}`"
            @click="toggleCollapse(panel.id)">
            <u-icon :name="getCollapseIcon(panel.id)" class="w-3.5 h-3.5" />
          </button>

          <!-- Slot content -->
          <slot :name="panel.id" />
        </div>
      </div>

      <!-- Resize handle (between panels, not after the last one) -->
      <div v-if="index < PANELS.length - 1" class="resize-handle" :class="{
        'handle-disabled': isCollapsed(PANELS[index]!.id) || isCollapsed(PANELS[index + 1]!.id),
      }" @mousedown="
        !isCollapsed(PANELS[index]!.id) && !isCollapsed(PANELS[index + 1]!.id)
          ? startResize(index as 0 | 1, $event)
          : undefined
        ">
        <div class="handle-grip">
          <span class="grip-dot" />
          <span class="grip-dot" />
          <span class="grip-dot" />
        </div>
      </div>
    </template>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- MOBILE LAYOUT: Bottom tabs + translated panel track            -->
  <!-- ═══════════════════════════════════════════════════════════════ -->
  <div v-else class="workspace-layout-mobile">


    <!-- Tab-controlled panel container -->
    <div class="mobile-panels-container">
      <div class="mobile-panels-track" :style="{ transform: `translateX(-${activePanelIndex * 100}%)` }">
        <div v-for="panel in PANELS" :key="panel.id" class="mobile-panel" :data-panel-id="panel.id"
          :aria-hidden="activeTab !== panel.id" :inert="activeTab !== panel.id">
          <slot :name="panel.id" />
        </div>
      </div>
    </div>
    <!-- Tab bar -->
    <nav class="mobile-tab-bar" aria-label="Workspace sections">
      <button v-for="panel in PANELS" :key="panel.id" type="button" :aria-selected="activeTab === panel.id"
        :class="['mobile-tab-btn', activeTab === panel.id && 'is-active']" @click="scrollToTab(panel.id)">
        <span class="mobile-tab-indicator" aria-hidden="true" />
        <u-icon :name="panel.icon" class="mobile-tab-icon" />
        <span class="mobile-tab-label">{{ panel.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════
   DESKTOP LAYOUT
   ═══════════════════════════════════════════════════════════════════════ */

.workspace-layout-desktop {
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  gap: 0;
  overflow: hidden;
}

.workspace-layout-desktop.is-resizing {
  cursor: col-resize;
}

/* ─── Panel ─────────────────────────────────────────────────────── */

.workspace-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.workspace-panel-inner {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

/* ─── Collapsed Strip ───────────────────────────────────────────── */

.collapsed-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 12px 0;
  cursor: pointer;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.collapsed-strip:hover {
  background: var(--ui-bg-elevated, #f8f9fa);
  border-color: var(--color-primary, #6366f1);
}

.collapsed-strip-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
}

.collapsed-icon {
  width: 20px;
  height: 20px;
  opacity: 0.7;
  color: var(--color-primary, #6366f1);
}

.collapsed-label {
  writing-mode: vertical-lr;
  text-orientation: mixed;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ui-text-dimmed, #64748b);
  white-space: nowrap;
}

.collapsed-expand-icon {
  width: 16px;
  height: 16px;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.collapsed-strip:hover .collapsed-expand-icon {
  opacity: 1;
  color: var(--color-primary, #6366f1);
}

/* ─── Collapse Button ───────────────────────────────────────────── */

.collapse-btn {
  position: absolute;
  z-index: 20;
  top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--ui-bg, #fff);
  border: 1px solid var(--ui-border, #e2e8f0);
  color: var(--ui-text-dimmed, #94a3b8);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.15s ease, color 0.15s ease, transform 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.workspace-panel:hover .collapse-btn {
  opacity: 1;
}

.collapse-btn:hover {
  background: var(--color-primary, #6366f1);
  color: white;
  border-color: var(--color-primary, #6366f1);
  transform: scale(1.1);
}

/* Position collapse buttons based on panel position */
.collapse-btn-hub {
  right: 8px;
}

.collapse-btn-notes {
  left: 8px;
}

.collapse-btn-board {
  left: 8px;
}

/* ─── Resize Handle ─────────────────────────────────────────────── */

.resize-handle {
  flex: 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  position: relative;
  z-index: 10;
  transition: background 0.15s ease;
  border-radius: 4px;
  margin: 8px 0;
}

.resize-handle::before {
  content: "";
  position: absolute;
  inset: 0 -4px;
  /* Expand hit area */
}

.resize-handle:hover {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 12%, transparent);
}

.resize-handle.handle-disabled {
  cursor: default;
  pointer-events: none;
  opacity: 0.3;
}

.handle-grip {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  opacity: 0.35;
  transition: opacity 0.2s ease;
}

.resize-handle:hover .handle-grip {
  opacity: 0.8;
}

.workspace-layout-desktop.is-resizing .resize-handle .handle-grip {
  opacity: 1;
}

.grip-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-primary, #6366f1);
}

/* Active resize visual feedback */
.workspace-layout-desktop.is-resizing .resize-handle {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 20%, transparent);
}

/* ═══════════════════════════════════════════════════════════════════════
   MOBILE LAYOUT
   ═══════════════════════════════════════════════════════════════════════ */

.workspace-layout-mobile {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

/* ─── Tab Bar ───────────────────────────────────────────────────── */

.mobile-tab-bar {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  background: var(--ui-bg, #fff);
  border-top: 1px solid var(--ui-border, #e2e8f0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.mobile-tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 52px;
  padding: 6px 4px 8px;
  position: relative;
  cursor: pointer;
  background: transparent;
  border: none;
  color: var(--ui-text-dimmed, #94a3b8);
  transition: color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.mobile-tab-btn:active {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 6%, transparent);
}

.mobile-tab-btn.is-active {
  color: var(--color-primary, #6366f1);
}

/* Active indicator line at the top of each tab */
.mobile-tab-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  border-radius: 0 0 3px 3px;
  background: var(--color-primary, #6366f1);
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-tab-btn.is-active .mobile-tab-indicator {
  width: 28px;
}

.mobile-tab-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.mobile-tab-btn.is-active .mobile-tab-icon {
  transform: translateY(-1px);
}

.mobile-tab-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}

/* ─── Mobile Panel Track ────────────────────────────────────────── */

.mobile-panels-container {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.mobile-panels-track {
  display: flex;
  height: 100%;
  min-height: 0;
  will-change: transform;
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-panel {
  flex: 0 0 100%;
  min-width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
</style>
