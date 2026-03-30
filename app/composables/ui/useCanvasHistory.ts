import { ref, computed } from "vue";
import type { CanvasShape } from "@@/shared/utils/note.contract";

const MAX_HISTORY = 50;

/**
 * useCanvasHistory — Undo/Redo stack for canvas shapes.
 *
 * Stores deep-cloned snapshots of the shapes array.
 * Truncates future states on new pushes.
 */
export function useCanvasHistory(initialShapes: CanvasShape[] = []) {
  function clone<T>(val: T): T {
    return JSON.parse(JSON.stringify(val));
  }

  const history = ref<CanvasShape[][]>([clone(initialShapes)]);
  const step = ref(0);

  const canUndo = computed(() => step.value > 0);
  const canRedo = computed(() => step.value < history.value.length - 1);

  const currentState = computed(() => history.value[step.value] ?? []);

  function pushState(shapes: CanvasShape[]) {
    // Truncate any future states
    history.value = history.value.slice(0, step.value + 1);
    // Push new snapshot
    history.value.push(clone(shapes));
    // Cap history
    if (history.value.length > MAX_HISTORY) {
      history.value = history.value.slice(history.value.length - MAX_HISTORY);
    }
    step.value = history.value.length - 1;
  }

  function undo(): CanvasShape[] | null {
    if (!canUndo.value) return null;
    step.value -= 1;
    return clone(currentState.value);
  }

  function redo(): CanvasShape[] | null {
    if (!canRedo.value) return null;
    step.value += 1;
    return clone(currentState.value);
  }

  function reset(shapes: CanvasShape[] = []) {
    history.value = [clone(shapes)];
    step.value = 0;
  }

  return {
    canUndo,
    canRedo,
    currentState,
    pushState,
    undo,
    redo,
    reset,
  };
}
