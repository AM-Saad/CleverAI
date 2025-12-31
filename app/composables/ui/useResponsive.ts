// app/composables/ui/useResponsive.ts
import { computed } from "vue";
import { useMediaQuery } from "./useMotionCommon";

/**
 * Composable for responsive breakpoint detection
 * Provides a single source of truth for screen size detection
 * Based on Tailwind CSS default breakpoints
 */
export function useResponsive() {
  // Tailwind default breakpoints
  const isSm = useMediaQuery("(min-width: 640px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");
  const is2Xl = useMediaQuery("(min-width: 1536px)");

  // Computed helpers for common use cases
  const isMobile = computed(() => !isMd.value);
  const isTablet = computed(() => isMd.value && !isLg.value);
  const isDesktop = computed(() => isLg.value);

  return {
    // Raw breakpoint checks
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,

    // Semantic helpers
    isMobile,
    isTablet,
    isDesktop,
  };
}
