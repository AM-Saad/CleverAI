/**
 * Haptic Feedback Engine for Cognilo
 * Provides tactile vibration feedback presets with safety fallbacks and browser policy guards.
 */
export type HapticRatingLevel = 'again' | 'hard' | 'good' | 'easy'

export function useHaptics() {
  const isSupported = computed(() => {
    return import.meta.client && typeof navigator !== 'undefined' && 'vibrate' in navigator
  })

  /**
   * Safely trigger a vibration pattern
   */
  const vibrate = (pattern: number | number[]) => {
    if (!isSupported.value) return
    try {
      navigator.vibrate(pattern)
    } catch (err) {
      // Ignored silently (e.g., user gesture requirement not met)
    }
  }

  // Preset signatures
  const selection = () => vibrate(8)
  const light = () => vibrate(12)
  const medium = () => vibrate(25)
  const heavy = () => vibrate(45)
  const success = () => vibrate([15, 30, 20])
  const error = () => vibrate([40, 40, 40, 40, 40])

  /**
   * Dedicated haptics for SM-2 Spaced Repetition card rating buttons
   */
  const rating = (level: HapticRatingLevel) => {
    switch (level) {
      case 'again':
        vibrate([35, 40, 35])
        break
      case 'hard':
        vibrate(30)
        break
      case 'good':
        vibrate(15)
        break
      case 'easy':
        vibrate([10, 20, 15])
        break
    }
  }

  return {
    isSupported,
    vibrate,
    selection,
    light,
    medium,
    heavy,
    success,
    error,
    rating,
  }
}
