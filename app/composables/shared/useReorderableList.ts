import { ref, reactive, computed, watch, nextTick, defineComponent, type Ref, type ComputedRef } from 'vue';

/**
 * Options for configuring the reorderable list composable
 */
export interface UseReorderableListOptions<T extends { id: string }> {
  /** Function to call when reordering is complete */
  onReorder: (newOrder: T[]) => Promise<boolean>;
  /** Optional: Called when drag state changes (for notifying parent components) */
  onDragStateChange?: (isDragging: boolean) => void;
  /** ID field key for the DragTracker component props (default: 'id') */
  idKey?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Component name for debug logs */
  debugName?: string;
}

/**
 * Return type for the useReorderableList composable
 */
export interface UseReorderableListReturn<T extends { id: string }> {
  /** Local items array for v-model binding with ReorderGroup */
  localItems: Ref<T[]>;
  /** Whether a reorder operation is in progress */
  isReordering: Ref<boolean>;
  /** Whether any item is currently being dragged */
  isAnyDragging: ComputedRef<boolean>;
  /** Whether dragging should be disabled (during reorder) */
  isDragDisabled: ComputedRef<boolean>;
  /** Update drag state for a specific item */
  updateDragState: (id: string, isDragging: boolean) => void;
  /** DragTracker component for use in templates */
  DragTracker: ReturnType<typeof defineComponent>;
  /** Sync local items with source (call when props change) */
  syncFromSource: (items: T[]) => void;
}

/**
 * Composable for managing drag-and-drop reorderable lists with optimistic updates.
 * 
 * Handles:
 * - Local state management for smooth drag UX
 * - Preventing props from overwriting local state during drag
 * - Server echo detection to prevent revert after successful reorder
 * - Loading state and drag disabled state
 * - Error rollback
 * 
 * @example
 * ```vue
 * const { localItems, isReordering, DragTracker, syncFromSource } = useReorderableList({
 *   onReorder: (items) => store.reorderItems(items),
 *   idKey: 'itemId',
 *   debugName: 'MyColumn'
 * });
 * 
 * // Sync with props
 * watch(() => props.items, (items) => syncFromSource(items), { immediate: true });
 * ```
 */
export function useReorderableList<T extends { id: string }>(
  options: UseReorderableListOptions<T>
): UseReorderableListReturn<T> {
  const { onReorder, onDragStateChange, idKey = 'itemId', debug = false, debugName = 'ReorderableList' } = options;

  // Local state
  const localItems = ref<T[]>([]) as Ref<T[]>;
  const isReordering = ref(false);
  const draggingStates = reactive<Map<string, boolean>>(new Map());

  // Tracking variables
  let pendingReorder: T[] | null = null;
  let lastReorderedIds = '';

  // Debug logger
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log(`[${debugName}]`, ...args);
    }
  };

  // Computed: check if any item is being dragged
  const isAnyDragging = computed(() => {
    return Array.from(draggingStates.values()).some(v => v === true);
  });

  // Computed: disable dragging during reorder
  const isDragDisabled = computed(() => isReordering.value);

  // Notify parent when drag state changes
  watch(isAnyDragging, (isDragging) => {
    onDragStateChange?.(isDragging);
  }, { immediate: true });

  // Track when local items change during drag
  watch(
    localItems,
    (newOrder, oldOrder) => {
      if (isAnyDragging.value && oldOrder) {
        // Only store pending reorder if items are the same (just reordered)
        const newIds = new Set(newOrder.map(i => i.id));
        const oldIds = new Set(oldOrder.map(i => i.id));
        const sameItems = newIds.size === oldIds.size &&
          Array.from(newIds).every(id => oldIds.has(id));

        if (sameItems) {
          log('Order changed during drag, storing pending reorder');
          pendingReorder = [...newOrder];
        } else {
          log('Items changed (cross-list move), skipping reorder');
          pendingReorder = null;
        }
      }
    },
    { deep: false }
  );

  // Watch for drag end to execute reorder
  watch(
    isAnyDragging,
    async (isDragging, wasDragging) => {
      if (wasDragging && !isDragging && pendingReorder) {
        log('Drag ended, executing reorder');
        const orderToExecute = [...pendingReorder];
        pendingReorder = null;

        // IMPORTANT: Set reordering flag IMMEDIATELY to prevent sync from reverting
        // This blocks syncFromSource before any reactivity can change localItems
        isReordering.value = true;

        await nextTick();
        await executeReorder(orderToExecute);
      }
    }
  );

  // Update drag state for individual items
  const updateDragState = (id: string, isDragging: boolean) => {
    draggingStates.set(id, isDragging);
  };

  // Execute the reorder operation
  const executeReorder = async (newOrder: T[]) => {
    // Note: isReordering is already true, set by the watcher
    log('Executing reorder for', newOrder.length, 'items');

    // Store current localItems for rollback (this is the dragged order we want to keep)
    const rollbackOrder = [...localItems.value];

    try {
      // Track this reorder to prevent reverting when server echoes back
      lastReorderedIds = newOrder.map(i => i.id).join(',');

      const success = await onReorder(newOrder);

      if (!success) {
        log('Reorder failed, rolling back');
        localItems.value = rollbackOrder;
        lastReorderedIds = '';
      }
    } finally {
      isReordering.value = false;
    }
  };

  // Sync local items from source (props)
  const syncFromSource = (items: T[]) => {
    // Don't sync during drag or reorder
    if (isAnyDragging.value || isReordering.value) {
      log('Skipping sync (drag or reorder in progress)');
      return;
    }

    // Check if this is server echo of our reorder
    const newIds = items.map(i => i.id).join(',');
    if (lastReorderedIds && newIds === lastReorderedIds) {
      log('Server confirmed reorder');
      lastReorderedIds = '';
    }

    localItems.value = [...items];
    pendingReorder = null;
  };

  // DragTracker component factory
  const DragTracker = defineComponent({
    name: 'DragTracker',
    props: {
      [idKey]: { type: String, required: true },
      isDragging: { type: Boolean, required: true }
    },
    watch: {
      isDragging: {
        handler(newVal: boolean) {
          updateDragState((this as Record<string, unknown>)[idKey] as string, newVal);
        },
        immediate: true
      }
    },
    render: () => null
  });

  return {
    localItems,
    isReordering,
    isAnyDragging,
    isDragDisabled,
    updateDragState,
    DragTracker,
    syncFromSource
  };
}
