// app/composables/ui/useAdaptiveToolbar.ts
import { ref, computed, onMounted } from "vue";
import { useResizeObserver } from "@vueuse/core";

export type ToolbarTier = "wide" | "compact" | "collapsed";

interface AdaptiveToolbarOptions {
  /** Width above which all toolbar items are fully visible (default: 500) */
  wideBreakpoint?: number;
  /** Width above which secondary actions are visible as icons (default: 350) */
  compactBreakpoint?: number;
}

/**
 * Composable for adaptive toolbar behavior.
 *
 * Uses ResizeObserver to detect the actual container width and returns
 * a reactive `tier` that determines which toolbar items should be visible.
 *
 * Usage:
 * ```ts
 * const { containerRef, tier, showLabels, showSecondaryActions } = useAdaptiveToolbar();
 * ```
 *
 * Tiers:
 * - **wide** (>500px): All items visible with full labels
 * - **compact** (350–500px): Icon-only buttons, search hidden or icon-only
 * - **collapsed** (<350px): Only title + overflow menu (⋯)
 */
export function useAdaptiveToolbar(options?: AdaptiveToolbarOptions) {
  const wideBreakpoint = options?.wideBreakpoint ?? 600;
  const compactBreakpoint = options?.compactBreakpoint ?? 350;

  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(9999); // Default to wide until measured

  // A grace period on mount prevents the "flash of collapsed state" when a panel
  // is clicked to expand. Because the container physically starts at 44px during
  // the CSS expansion animation, we ignore these tiny widths for the first 300ms,
  // allowing it to render the final state immediately. The outer container's
  // overflow:hidden handles smoothly revealing the content.
  const isMounting = ref(true);

  onMounted(() => {
    setTimeout(() => {
      isMounting.value = false;
    }, 300); // Matches the 250ms CSS layout transition
  });

  // Observe container width changes in real-time
  useResizeObserver(containerRef, (entries) => {
    const entry = entries[0];
    if (entry) {
      const w = entry.contentRect.width;
      // Skip evaluating tiny widths during the expansion animation
      if (isMounting.value && w < 250) {
        return;
      }
      containerWidth.value = w;
    }
  });

  /** Current responsive tier based on container width */
  const tier = computed<ToolbarTier>(() => {
    if (containerWidth.value >= wideBreakpoint) return "wide";
    if (containerWidth.value >= compactBreakpoint) return "compact";
    return "collapsed";
  });

  /** Whether to show text labels on buttons (wide tier only) */
  const showLabels = computed(() => tier.value === "wide");

  /** Whether to show secondary action buttons inline (wide + compact tiers) */
  const showSecondaryActions = computed(() => tier.value !== "collapsed");

  /** Whether toolbar is in collapsed mode (overflow menu needed) */
  const isOverflowing = computed(() => tier.value === "collapsed");

  return {
    containerRef,
    containerWidth,
    tier,
    showLabels,
    showSecondaryActions,
    isOverflowing,
  };
}
