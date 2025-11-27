/**
 * Keyboard shortcut handlers configuration
 * Maps keyboard keys to action names
 */
export interface KeyboardShortcutHandlers {
  onRevealAnswer?: () => void
  onGrade?: (grade: string) => void
  onNavigatePrevious?: () => void
  onNavigateNext?: () => void
  onSkip?: () => void
  onToggleShortcuts?: () => void
  onToggleAnalytics?: () => void
  onCloseAll?: () => void
}

/**
 * Composable for handling keyboard shortcuts in review interface
 * Provides centralized keyboard event handling with customizable callbacks
 */
export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers) => {
  /**
   * Check if the event target is an input field
   * Prevents shortcuts from firing when user is typing
   */
  const isInputField = (target: EventTarget | null): boolean => {
    if (!target) return false
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target as HTMLElement).isContentEditable
    )
  }

  /**
   * Main keyboard event handler
   * Routes key presses to appropriate handlers
   */
  const handleKeydown = (event: KeyboardEvent) => {
    // Skip if typing in input fields
    if (isInputField(event.target)) {
      return
    }

    const key = event.key

    // Space - Reveal answer
    if (key === ' ' || key === 'Space') {
      event.preventDefault()
      handlers.onRevealAnswer?.()
      return
    }

    // Numbers 1-6 - Grade card
    if (/^[1-6]$/.test(key)) {
      event.preventDefault()
      // Convert to 0-5 index (1 key = grade 0, 6 key = grade 5)
      const gradeIndex = parseInt(key) - 1
      handlers.onGrade?.(gradeIndex.toString())
      return
    }

    // Arrow keys - Navigate
    if (key === 'ArrowLeft') {
      event.preventDefault()
      handlers.onNavigatePrevious?.()
      return
    }

    if (key === 'ArrowRight') {
      event.preventDefault()
      handlers.onNavigateNext?.()
      return
    }

    // S - Skip card
    if (key === 's' || key === 'S') {
      event.preventDefault()
      handlers.onSkip?.()
      return
    }

    // ? - Toggle shortcuts help
    if (key === '?') {
      event.preventDefault()
      handlers.onToggleShortcuts?.()
      return
    }

    // A - Toggle analytics
    if (key === 'a' || key === 'A') {
      event.preventDefault()
      handlers.onToggleAnalytics?.()
      return
    }

    // Escape - Close all panels
    if (key === 'Escape') {
      event.preventDefault()
      handlers.onCloseAll?.()
      return
    }
  }

  /**
   * Register global keyboard event listener
   * Returns cleanup function to remove listener
   */
  const register = (): (() => void) => {
    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
    }
  }

  /**
   * Get keyboard shortcut map for display
   * Returns array of shortcut descriptions
   */
  const getShortcutMap = () => {
    return [
      { key: 'Space', description: 'Show Answer', group: 'navigation' },
      { key: '1-6', description: 'Grade Card', group: 'grading' },
      { key: '← / →', description: 'Navigate Cards', group: 'navigation' },
      { key: 'S', description: 'Skip Card', group: 'navigation' },
      { key: '?', description: 'Toggle Help', group: 'ui' },
      { key: 'A', description: 'Toggle Analytics', group: 'ui' },
      { key: 'Esc', description: 'Close Panels', group: 'ui' },
    ]
  }

  /**
   * Check if a key combination is available
   * Useful for conditional shortcut display
   */
  const isShortcutAvailable = (shortcut: string): boolean => {
    const handlerMap: Record<string, boolean> = {
      'space': !!handlers.onRevealAnswer,
      'numbers': !!handlers.onGrade,
      'arrows': !!(handlers.onNavigatePrevious || handlers.onNavigateNext),
      'skip': !!handlers.onSkip,
      'help': !!handlers.onToggleShortcuts,
      'analytics': !!handlers.onToggleAnalytics,
      'escape': !!handlers.onCloseAll,
    }
    
    return handlerMap[shortcut.toLowerCase()] ?? false
  }

  return {
    handleKeydown,
    register,
    getShortcutMap,
    isShortcutAvailable,
  }
}
