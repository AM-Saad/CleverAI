// app/composables/ui/useSheetMotion.ts
import { ref, computed, type Ref } from 'vue'
import { useElementResize } from './useMotionCommon'

export interface SheetOptions {
  sheetHeight: string
  handleVisible: number
  threshold: number
  fastVelocity: number
}

export interface SheetAPI {
  axis: 'y'
  open: number
  closed: Ref<number>
  constraints: { top: number; bottom: number }
  containerClass: string
  style: Record<string, any>
  recompute(): void
  decide(offset: number, velocity: number, startPos: number): 'open' | 'close'
}

export function useSheetMotion(panelEl: Ref<HTMLElement | null | undefined>, opts: SheetOptions): SheetAPI {
  const OPEN = 0
  const closed = ref(500)

  const recompute = () => {
    const el = panelEl.value
    if (!el) return
    const h = el.getBoundingClientRect().height || 0
    closed.value = Math.max(0, h - opts.handleVisible)
  }

  useElementResize(panelEl, recompute)
  // Initial guess
  if (typeof window !== 'undefined') {
    const guess = Math.max(Math.min(window.innerHeight * 0.75, window.innerHeight - 80), 240) - opts.handleVisible
    closed.value = guess
  }

  const constraints = computed(() => ({ top: OPEN, bottom: closed.value }))
  const containerClass = computed(() => 'left-0 right-0 bottom-0 h-[75vh] w-full rounded-t-3xl')

  function decide(offset: number, velocity: number, startPos: number): 'open' | 'close' {
    // fling
    if (velocity <= -opts.fastVelocity) return 'open'   // up-fast
    if (velocity >=  opts.fastVelocity) return 'close'  // down-fast

    if (Math.abs(startPos - closed.value) <= 2) {
      // started closed → need upward drag (offset <= -threshold)
      return (offset <= -opts.threshold) ? 'open' : 'close'
    }
    if (Math.abs(startPos - OPEN) <= 2) {
      // started open → need downward drag (offset >= threshold)
      return (offset >= opts.threshold) ? 'close' : 'open'
    }
    // nearest end
    const finalPos = startPos + offset
    const toOpen = Math.abs(finalPos - OPEN)
    const toClose = Math.abs(finalPos - closed.value)
    return (toClose < toOpen) ? 'close' : 'open'
  }

  return {
    axis: 'y',
    open: OPEN,
    closed,
    constraints: constraints.value,
    containerClass: containerClass.value,
    style: { touchAction: 'pan-y', height: opts.sheetHeight },
    recompute,
    decide,
  }
}
