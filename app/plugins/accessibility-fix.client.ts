/**
 * Accessibility fix for aria-hidden issue with focused descendants
 * This plugin ensures that when an element receives focus, none of its ancestors have aria-hidden="true"
 */

export default defineNuxtPlugin(() => {
  // Only run in browser
  if (import.meta.server) return

  let timeoutId: number | null = null

  const handleFocus = (event: FocusEvent) => {
    const target = event.target as Element
    if (!target || typeof target.closest !== 'function') return

    // Debounce to avoid excessive DOM queries
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = window.setTimeout(() => {
      // Check if any ancestor has aria-hidden="true"
      let current = target.parentElement
      while (current) {
        if (current.getAttribute('aria-hidden') === 'true') {
          console.warn('[A11Y Fix] Removing aria-hidden from ancestor of focused element:', {
            focusedElement: target,
            ancestorWithAriaHidden: current
          })
          
          // Remove aria-hidden to fix accessibility issue
          current.removeAttribute('aria-hidden')
          
          // Alternatively, you could use inert instead:
          // current.setAttribute('inert', 'true')
          // current.removeAttribute('aria-hidden')
        }
        current = current.parentElement
      }
      timeoutId = null
    }, 10)
  }

  // Add global focus listener
  document.addEventListener('focusin', handleFocus, true)
})