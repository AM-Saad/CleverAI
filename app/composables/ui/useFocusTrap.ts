// app/composables/ui/useFocusTrap.ts
import { ref, watch, type Ref } from 'vue'
import { getFocusableElements } from '~/composables/ui/useMotionCommon'

export interface FocusTrapOptions {
  /** Called when the user presses Escape inside the trapped region */
  onEscape?: () => void
  /** CSS selector to focus first when opened (falls back to first focusable, then panel) */
  initialFocus?: string
}

/**
 * Simple, reusable focus trap for dialogs/drawers/sheets.
 * - Records previously focused element and restores it on close
 * - Moves focus inside on open (selector → first focusable → panel)
 * - Traps Tab/Shift+Tab within the region
 */
export function useFocusTrap(active: Ref<boolean>, panelEl: Ref<HTMLElement | null>, opts: FocusTrapOptions = {}) {
  const lastFocusedEl = ref<HTMLElement | null>(null)

  watch(active, (v) => {
    if (v) {
      lastFocusedEl.value = (document.activeElement as HTMLElement) || null
      requestAnimationFrame(() => {
        const root = panelEl.value
        if (!root) return
        if (opts.initialFocus) {
          const el = root.querySelector<HTMLElement>(opts.initialFocus)
          if (el) { el.focus(); return }
        }
        const focusables = getFocusableElements(root)
        if (focusables.length) focusables[0].focus()
        else root.focus()
      })
    } else {
      requestAnimationFrame(() => { try { lastFocusedEl.value?.focus() } catch {} })
    }
  })

  function onKeydown(e: KeyboardEvent) {
    const root = panelEl.value
    if (!root) return

    if (e.key === 'Escape' && opts.onEscape) {
      opts.onEscape()
      e.stopPropagation()
      e.preventDefault()
      return
    }

    if (e.key !== 'Tab') return

    const els = getFocusableElements(root)
    if (!els.length) return

    const first = els[0]
    const last = els[els.length - 1]
    const activeEl = document.activeElement as HTMLElement | null

    if (e.shiftKey) {
      if (activeEl === first || !root.contains(activeEl)) {
        last.focus()
        e.preventDefault()
      }
    } else {
      if (activeEl === last) {
        first.focus()
        e.preventDefault()
      }
    }
  }

  return { onKeydown }
}
