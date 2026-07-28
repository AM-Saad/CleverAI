/**
 * Keeps date selection behind both independent signals the browser provides:
 * scroll motion has settled, and every mouse/touch contact has ended.
 *
 * Native touch scrolling commonly dispatches `pointercancel` while the finger
 * is still on the screen. Tracking touches separately prevents that browser
 * hand-off from being mistaken for a completed gesture.
 */
export function createDateDialInteractionGate() {
  const activePointerIds = new Set<number>();
  let activeTouchCount = 0;
  let isScrollSettled = true;

  return {
    markScrolling() {
      isScrollSettled = false;
    },

    markScrollSettled() {
      isScrollSettled = true;
    },

    startPointer(pointerId: number) {
      activePointerIds.add(pointerId);
    },

    endPointer(pointerId: number) {
      activePointerIds.delete(pointerId);
    },

    setActiveTouchCount(count: number) {
      activeTouchCount = Math.max(0, count);
    },

    isReadyToCommit() {
      return (
        isScrollSettled && activePointerIds.size === 0 && activeTouchCount === 0
      );
    },

    reset() {
      activePointerIds.clear();
      activeTouchCount = 0;
      isScrollSettled = true;
    },
  };
}
