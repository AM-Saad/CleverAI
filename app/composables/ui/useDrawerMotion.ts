// app/composables/ui/useDrawerMotion.ts
import { ref, computed, type Ref } from "vue";
import {
  useElementResize,
  isFlingToOpen,
  isFlingToClose,
  startedClosed,
  startedOpen,
  nearerEnd
} from "./useMotionCommon";

export interface DrawerOptions {
  side: "right" | "left";
  handleVisible: number;
  widthClasses: string;
  threshold: number;
  fastVelocity: number;
}

export interface DrawerAPI {
  axis: "x";
  open: number;
  closed: Ref<number>;
  constraints: ComputedRef<{ left: number; right: number }>;
  containerClass: string;
  handleClass: string;
  style: Record<string, string>;
  recompute(): void;
  decide(offset: number, velocity: number, startPos: number): "open" | "close";
}

export function getInitialDrawerClosed(side: "right" | "left", handleVisible: number) {
  if (typeof window === "undefined") return side === "right" ? 300 : -300;
  const guess = Math.max(window.innerWidth / 3, 240) - handleVisible;
  return side === "right" ? guess : -guess;
}

export function useDrawerMotion(
  panelEl: Ref<HTMLElement | null | undefined>,
  opts: DrawerOptions,
): DrawerAPI {
  const OPEN = 0;
  const closed = ref(getInitialDrawerClosed(opts.side, opts.handleVisible));

  const recompute = () => {
    const el = panelEl.value;
    if (!el) return;
    const w = el.getBoundingClientRect().width || 0;
    const c = Math.max(0, w - opts.handleVisible);
    closed.value = opts.side === "right" ? c : -c;
  };

  useElementResize(panelEl, recompute);

  const constraints = computed(() =>
    opts.side === "right"
      ? { left: OPEN, right: closed.value }
      : { left: closed.value, right: OPEN },
  );

  const containerClass = computed(
    () =>
      `${opts.side === "right" ? "top-0 right-0 rounded-l-lg" : "top-0 left-0 rounded-r-lg"} h-full ${opts.widthClasses}`,
  );

  const handleClass = computed(() =>
    opts.side === "right" ? "left-2" : "right-2",
  );

  function decide(
    offset: number,
    velocity: number,
    startPos: number,
  ): "open" | "close" {
    if (isFlingToOpen(velocity, opts.fastVelocity)) return "open";
    if (isFlingToClose(velocity, opts.fastVelocity)) return "close";

    if (startedClosed(startPos, closed.value)) {
      const isOpening = opts.side === "right" ? offset <= -opts.threshold : offset >= opts.threshold;
      return isOpening ? "open" : "close";
    }
    if (startedOpen(startPos, OPEN)) {
      const isClosing = opts.side === "right" ? offset >= opts.threshold : offset <= -opts.threshold;
      return isClosing ? "close" : "open";
    }

    return nearerEnd(startPos + offset, OPEN, closed.value);
  }

  return {
    axis: "x",
    open: OPEN,
    closed,
    constraints,
    containerClass: containerClass.value,
    handleClass: handleClass.value,
    style: { touchAction: "pan-x" },
    recompute,
    decide,
  };
}
