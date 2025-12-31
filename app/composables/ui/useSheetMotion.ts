// app/composables/ui/useSheetMotion.ts
import { ref, computed, type Ref } from "vue";
import {
  useElementResize,
  isFlingToOpen,
  isFlingToClose,
  startedClosed,
  startedOpen,
  nearerEnd
} from "./useMotionCommon";

export interface SheetOptions {
  sheetHeight: string;
  handleVisible: number;
  threshold: number;
  fastVelocity: number;
}

export interface SheetAPI {
  axis: "y";
  open: number;
  closed: Ref<number>;
  constraints: ComputedRef<{ top: number; bottom: number }>;
  containerClass: string;
  style: Record<string, any>;
  recompute(): void;
  decide(offset: number, velocity: number, startPos: number): "open" | "close";
}

export function getInitialSheetClosed(handleVisible: number) {
  if (typeof window === "undefined") return 500;
  const guess =
    Math.max(
      Math.min(window.innerHeight * 0.75, window.innerHeight - 80),
      240,
    ) - handleVisible;
  return guess;
}

export function useSheetMotion(
  panelEl: Ref<HTMLElement | null | undefined>,
  opts: SheetOptions,
): SheetAPI {
  const OPEN = 0;
  const closed = ref(getInitialSheetClosed(opts.handleVisible));

  const recompute = () => {
    const el = panelEl.value;
    if (!el) return;
    const h = el.getBoundingClientRect().height || 0;
    closed.value = Math.max(0, h - opts.handleVisible);
  };

  useElementResize(panelEl, recompute);

  const constraints = computed(() => ({ top: OPEN, bottom: closed.value }));
  const containerClass = computed(
    () => "left-0 right-0 bottom-0 h-[75vh] w-full rounded-t-3xl",
  );

  function decide(
    offset: number,
    velocity: number,
    startPos: number,
  ): "open" | "close" {
    if (isFlingToOpen(velocity, opts.fastVelocity)) return "open"; // up-fast
    if (isFlingToClose(velocity, opts.fastVelocity)) return "close"; // down-fast

    if (startedClosed(startPos, closed.value)) {
      // started closed → need upward drag (offset <= -threshold)
      return offset <= -opts.threshold ? "open" : "close";
    }
    if (startedOpen(startPos, OPEN)) {
      // started open → need downward drag (offset >= threshold)
      return offset >= opts.threshold ? "close" : "open";
    }

    return nearerEnd(startPos + offset, OPEN, closed.value);
  }

  return {
    axis: "y",
    open: OPEN,
    closed,
    constraints,
    containerClass: containerClass.value,
    style: { touchAction: "pan-y", height: opts.sheetHeight },
    recompute,
    decide,
  };
}
