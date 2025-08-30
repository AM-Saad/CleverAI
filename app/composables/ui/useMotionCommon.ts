// app/composables/ui/useMotionCommon.ts
import { onMounted, onBeforeUnmount, ref, type Ref } from 'vue'

export function useMediaQuery(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | null = null
  let onChange: ((e: MediaQueryListEvent) => void) | null = null

  onMounted(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    mql = window.matchMedia(query)
    matches.value = mql.matches
    onChange = (e) => { matches.value = e.matches }
    try {
      if ('addEventListener' in mql) mql.addEventListener('change', onChange!)
      else (mql as any).addListener(onChange)
    } catch {}
  })

  onBeforeUnmount(() => {
    if (!mql || !onChange) return
    try {
      if ('removeEventListener' in mql) mql.removeEventListener('change', onChange!)
      else (mql as any).removeListener(onChange)
    } catch {}
    mql = null
    onChange = null
  })

  return matches
}

export function useElementResize(elRef: Ref<HTMLElement | null | undefined>, cb: () => void) {
  let ro: ResizeObserver | null = null
  const attach = () => {
    const el = elRef.value as Element | null
    if (el && ro) ro.observe(el)
    else requestAnimationFrame(attach)
  }

  onMounted(() => {
    try {
      ro = new ResizeObserver(() => cb())
      attach()
    } catch {}
  })

  onBeforeUnmount(() => {
    if (ro) {
      try { ro.disconnect() } catch {}
      ro = null
    }
  })
}

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>([
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(','))
  return Array.from(nodes).filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length))
}

export function focusFirst(root: HTMLElement) {
  const els = getFocusableElements(root)
  if (els.length) els[0].focus()
  else root.focus()
}

export function trapTab(e: KeyboardEvent, root: HTMLElement) {
  if (e.key !== 'Tab') return
  const els = getFocusableElements(root)
  if (!els.length) return
  const first = els[0]
  const last = els[els.length - 1]
  const active = document.activeElement as HTMLElement | null

  if (e.shiftKey) {
    if (active === first || !root.contains(active)) {
      last.focus()
      e.preventDefault()
    }
  } else {
    if (active === last) {
      first.focus()
      e.preventDefault()
    }
  }
}

// Drag math helpers
export function isFlingToOpen(velocity: number, fast: number) {
  return velocity <= -fast
}
export function isFlingToClose(velocity: number, fast: number) {
  return velocity >= fast
}
export function startedClosed(start: number, closed: number) {
  return Math.abs(start - closed) <= 2
}
export function startedOpen(start: number, open: number) {
  return Math.abs(start - open) <= 2
}
export function nearerEnd(finalPos: number, open: number, closed: number) {
  return Math.abs(finalPos - closed) < Math.abs(finalPos - open) ? 'close' : 'open'
}
