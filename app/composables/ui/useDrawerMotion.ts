// app/composables/ui/useDrawerMotion.ts
import { computed, ref, watch, type Ref } from 'vue'
import { useElementResize } from './useMotionCommon'

export interface DrawerOptions {
  side: 'right' | 'left'
  handleVisible: number
  widthClasses: string
  threshold: number
  fastVelocity: number
}

export interface DrawerAPI {
  axis: 'x'
  open: number
  closed: Ref<number>
  constraints: { left: number; right: number }
  containerClass: string
  handleClass: string
  style: Record<string, any>
  recompute(): void
  decide(offset: number, velocity: number, startPos: number): 'open' | 'close'
}

export function useDrawerMotion(panelEl: Ref<HTMLElement | null | undefined>, opts: DrawerOptions): DrawerAPI {
  const OPEN = 0
  const closed = ref(300)

  const recompute = () => {
    const el = panelEl.value
    if (!el) return
    const w = el.getBoundingClientRect().width || 0
    const c = Math.max(0, w - opts.handleVisible)
    closed.value = opts.side === 'right' ? c : -c
  }

  useElementResize(panelEl, recompute)
  // Initial guess (works before measurement lands)
  if (typeof window !== 'undefined') {
    const guess = Math.max(window.innerWidth / 3, 240) - opts.handleVisible
    closed.value = opts.side === 'right' ? guess : -guess
  }

  const constraints = computed(() =>
    opts.side === 'right'
      ? { left: OPEN, right: closed.value }
      : { left: closed.value, right: OPEN }
  )

  const containerClass = computed(() =>
    `${opts.side === 'right' ? 'top-0 right-0 rounded-l-3xl' : 'top-0 left-0 rounded-r-3xl'} h-full ${opts.widthClasses}`
  )

  const handleClass = computed(() => (opts.side === 'right' ? 'left-2' : 'right-2'))

  function decide(offset: number, velocity: number, startPos: number): 'open' | 'close' {
    // fling
    if (velocity <= -opts.fastVelocity) return 'open'
    if (velocity >=  opts.fastVelocity) return 'close'

    if (Math.abs(startPos - closed.value) <= 2) {
      // started closed → need left drag to open (offset <= -threshold)
      return (offset <= -opts.threshold) ? 'open' : 'close'
    }
    if (Math.abs(startPos - OPEN) <= 2) {
      // started open → need right drag to close (offset >= threshold)
      return (offset >= opts.threshold) ? 'close' : 'open'
    }
    // nearest end
    const finalPos = startPos + offset
    const toOpen = Math.abs(finalPos - OPEN)
    const toClose = Math.abs(finalPos - closed.value)
    return (toClose < toOpen) ? 'close' : 'open'
  }

  return {
    axis: 'x',
    open: OPEN,
    closed,
    constraints: constraints.value,
    containerClass: containerClass.value,
    handleClass: handleClass.value,
    style: { touchAction: 'pan-x' },
    recompute,
    decide,
  }
}
