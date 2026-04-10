// app/composables/ui/useWorkspaceLayout.ts
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";

export type PanelId = "hub" | "notes" | "board";

/** Percentage snap steps for panel sizing */
const SNAP_STEPS = [20, 25, 33, 40, 50, 60, 67, 75, 80];

/** Minimum panel width in pixels before it should be collapsed */
const MIN_PANEL_PX = 280;

/** Width of a collapsed panel strip in pixels */
const COLLAPSED_WIDTH_PX = 44;

/** Transition duration in ms for animated size changes */
const TRANSITION_MS = 250;

/** Panel metadata */
const PANELS: { id: PanelId; label: string; icon: string }[] = [
  { id: "hub", label: "Learning Hub", icon: "i-lucide-graduation-cap" },
  { id: "notes", label: "Notes", icon: "i-lucide-notebook-pen" },
  { id: "board", label: "Board", icon: "i-lucide-kanban" },
];

function snapToStep(value: number): number {
  let closest = SNAP_STEPS[0]!;
  let minDist = Math.abs(value - closest);
  for (const step of SNAP_STEPS) {
    const dist = Math.abs(value - step);
    if (dist < minDist) {
      minDist = dist;
      closest = step;
    }
  }
  return closest;
}

function storageKey(workspaceId: string) {
  return `workspaceLayout_${workspaceId}`;
}

interface PersistedLayout {
  sizes: [number, number, number];
  collapsed: PanelId[];
}

export function useWorkspaceLayout(workspaceId: string) {
  // ─── Core State ───────────────────────────────────────────────────
  const panelSizes = ref<[number, number, number]>([33, 34, 33]);
  const collapsedPanels = ref<Set<PanelId>>(new Set());
  const activeTab = ref<PanelId>("notes"); // mobile active tab
  const isAnimating = ref(false);

  // ─── Resize State ─────────────────────────────────────────────────
  const isResizing = ref(false);
  const resizeHandleIndex = ref<0 | 1>(0); // 0 = between hub/notes, 1 = between notes/board
  const containerRef = ref<HTMLElement | null>(null);

  // ─── Computed ─────────────────────────────────────────────────────
  const visiblePanels = computed(() =>
    PANELS.filter((p) => !collapsedPanels.value.has(p.id))
  );

  const panelStyles = computed(() => {
    return PANELS.map((panel, index) => {
      if (collapsedPanels.value.has(panel.id)) {
        return {
          flexBasis: `${COLLAPSED_WIDTH_PX}px`,
          flexGrow: 0,
          flexShrink: 0,
          minWidth: `${COLLAPSED_WIDTH_PX}px`,
          transition: isResizing.value
            ? "none"
            : `flex-basis ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        };
      }
      return {
        flexBasis: `${panelSizes.value[index]}%`,
        flexGrow: 1,
        flexShrink: 1,
        minWidth: `${MIN_PANEL_PX}px`,
        transition: isResizing.value
          ? "none"
          : `flex-basis ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      };
    });
  });

  // ─── Collapse / Expand ────────────────────────────────────────────
  function toggleCollapse(panelId: PanelId) {
    const newSet = new Set(collapsedPanels.value);

    // Don't allow collapsing all panels — at least one must remain
    if (!newSet.has(panelId)) {
      const remainingVisible = PANELS.filter(
        (p) => !newSet.has(p.id) && p.id !== panelId
      );
      if (remainingVisible.length === 0) return;
      newSet.add(panelId);
    } else {
      newSet.delete(panelId);
    }

    // Trigger animation
    isAnimating.value = true;
    collapsedPanels.value = newSet;

    // Redistribute space among visible panels
    redistributeSizes();

    setTimeout(() => {
      isAnimating.value = false;
    }, TRANSITION_MS);

    saveLayout();
  }

  function isCollapsed(panelId: PanelId): boolean {
    return collapsedPanels.value.has(panelId);
  }

  function redistributeSizes() {
    const visible = PANELS.filter((p) => !collapsedPanels.value.has(p.id));
    if (visible.length === 0) return;

    const equalShare = Math.round(100 / visible.length);
    const newSizes: [number, number, number] = [...panelSizes.value];

    for (let i = 0; i < PANELS.length; i++) {
      if (collapsedPanels.value.has(PANELS[i]!.id)) {
        newSizes[i] = 0;
      } else {
        newSizes[i] = equalShare;
      }
    }
    panelSizes.value = newSizes;
  }

  // ─── Step-Based Resize ────────────────────────────────────────────
  function startResize(handleIndex: 0 | 1, event: MouseEvent) {
    event.preventDefault();
    isResizing.value = true;
    resizeHandleIndex.value = handleIndex;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResize);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isResizing.value || !containerRef.value) return;

    const rect = containerRef.value.getBoundingClientRect();
    const containerWidth = rect.width;

    // Account for collapsed panels and their fixed widths
    const collapsedCount = collapsedPanels.value.size;
    const availableWidth = containerWidth - collapsedCount * COLLAPSED_WIDTH_PX;

    // Mouse position relative to container left, as percentage of available space
    const mouseX = event.clientX - rect.left;

    // Determine which two panels the handle sits between
    const handleIdx = resizeHandleIndex.value;

    // Find the visible panel indices surrounding this handle
    // Handle 0 = between panel 0 and panel 1
    // Handle 1 = between panel 1 and panel 2
    const leftPanelIdx = handleIdx;
    const rightPanelIdx = handleIdx + 1;

    const leftPanel = PANELS[leftPanelIdx]!;
    const rightPanel = PANELS[rightPanelIdx]!;

    // Skip if either panel is collapsed
    if (
      collapsedPanels.value.has(leftPanel.id) ||
      collapsedPanels.value.has(rightPanel.id)
    ) {
      return;
    }

    // Calculate cumulative width of panels before the handle
    let cumulativeBeforeHandle = 0;
    for (let i = 0; i < leftPanelIdx; i++) {
      if (collapsedPanels.value.has(PANELS[i]!.id)) {
        cumulativeBeforeHandle += COLLAPSED_WIDTH_PX;
      } else {
        cumulativeBeforeHandle +=
          (panelSizes.value[i]! / 100) * availableWidth;
      }
    }
    // Add resize handle widths (8px each)
    cumulativeBeforeHandle += handleIdx * 8;

    // Calculate the desired left panel width
    const desiredLeftWidth = mouseX - cumulativeBeforeHandle;
    const desiredLeftPct = (desiredLeftWidth / availableWidth) * 100;

    // Combined percentage of both panels
    const combined =
      panelSizes.value[leftPanelIdx]! + panelSizes.value[rightPanelIdx]!;

    // Snap the left to a step
    const snappedLeft = snapToStep(Math.max(20, Math.min(80, desiredLeftPct)));
    const snappedRight = combined - snappedLeft;

    // Ensure neither panel goes below minimum (~20%)
    if (snappedRight < 20) return;

    const newSizes: [number, number, number] = [...panelSizes.value];
    newSizes[leftPanelIdx] = snappedLeft;
    newSizes[rightPanelIdx] = snappedRight;
    panelSizes.value = newSizes;
  }

  function stopResize() {
    isResizing.value = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResize);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    saveLayout();
  }

  // ─── Mobile Tab ───────────────────────────────────────────────────
  function setActiveTab(tab: PanelId) {
    activeTab.value = tab;
  }

  // ─── Persistence ──────────────────────────────────────────────────
  function saveLayout() {
    if (typeof window === "undefined") return;
    try {
      const data: PersistedLayout = {
        sizes: [...panelSizes.value],
        collapsed: Array.from(collapsedPanels.value),
      };
      localStorage.setItem(storageKey(workspaceId), JSON.stringify(data));
    } catch {
      // localStorage unavailable
    }
  }

  function loadLayout() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey(workspaceId));
      if (!raw) return;
      const data: PersistedLayout = JSON.parse(raw);
      if (
        Array.isArray(data.sizes) &&
        data.sizes.length === 3 &&
        data.sizes.every((s) => typeof s === "number")
      ) {
        panelSizes.value = data.sizes as [number, number, number];
      }
      if (Array.isArray(data.collapsed)) {
        collapsedPanels.value = new Set(
          data.collapsed.filter((id): id is PanelId =>
            ["hub", "notes", "board"].includes(id)
          )
        );
      }
    } catch {
      // Corrupt data — reset
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────
  onMounted(() => {
    loadLayout();
  });

  onBeforeUnmount(() => {
    // Cleanup any lingering listeners
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResize);
  });

  return {
    // Constants
    PANELS,
    COLLAPSED_WIDTH_PX,

    // State
    panelSizes,
    collapsedPanels,
    activeTab,
    isResizing,
    isAnimating,
    containerRef,

    // Computed
    visiblePanels,
    panelStyles,

    // Actions
    toggleCollapse,
    isCollapsed,
    startResize,
    setActiveTab,
    saveLayout,

    // Utility
    snapToStep,
  };
}
