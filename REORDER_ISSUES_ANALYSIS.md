# Board Items Reorder Logic - Issues Analysis

## Critical Issues Found

### 1. **Race Condition Between Props and Local State** 
**Location**: `BoardColumn.vue` lines 29-36

**Problem**: 
```typescript
watch(
  () => props.items,
  (newItems) => {
    localItems.value = [...newItems];
  },
  { immediate: true, deep: true }
);
```

The `localItems` is being continuously synced with `props.items` using a deep watcher. When a user drags an item:
1. User drags item → `localItems` changes
2. Debounced reorder triggers (800ms)
3. Store updates → props change → `localItems` resets
4. Race condition: prop update overwrites user's drag before API completes

**Impact**: Items jump back to original position or flicker during drag

---

### 2. **Stale Data from Filtered Props**
**Location**: `BoardColumn.vue` line 51 + `BoardNotesSection.vue` filtering

**Problem**:
- `BoardColumn` receives filtered items from parent via `props.items`
- When reordering, it passes `newOrder` (filtered items) to `reorderItemsInColumn()`
- But the store function expects ALL items in the column, not just filtered ones
- This causes order indices to be wrong when filters are active

**Example**:
- Column has 5 items [A, B, C, D, E]
- Filter shows only [A, C, E]
- User drags E before A → sends orders [E:0, A:1, C:2]
- Server applies: E=0, A=1, C=2, but B and D are missing!
- Result: Items B and D get wrong orders

---

### 3. **Debounce Too Long (800ms)**
**Location**: `BoardColumn.vue` line 51

**Problem**:
```typescript
reorderTimeout = setTimeout(() => {
  itemsStore.reorderItemsInColumn(props.columnId, newOrder);
}, 800);
```

800ms is too long for drag-and-drop operations. Users expect immediate feedback.

**Impact**: 
- Sluggish UX
- Multiple rapid drags can queue up
- Increases chance of race conditions

---

### 4. **Deep Watch Triggers Unnecessarily**
**Location**: `BoardColumn.vue` line 42

**Problem**:
```typescript
watch(
  localItems,
  (newOrder, oldOrder) => { ... },
  { deep: true }
);
```

Deep watching the entire array triggers on any property change (isLoading, isDirty, error, etc.), not just order changes.

**Impact**: 
- Performance issues
- False positives triggering reorder API calls
- Unnecessary debounce resets

---

### 5. **No Visual Feedback During Save**
**Location**: `useBoardItemsStore.ts` lines 644-720

**Problem**:
The store sets `isLoading` flags on individual items, but during reorder:
- No loading state is set
- User doesn't know if save succeeded or failed
- No rollback indication

---

### 6. **Server Updates columnId During Reorder**
**Location**: `server/api/board-items/reorder-in-column.patch.ts` lines 56-61

**Problem**:
```typescript
prisma.boardItem.update({
  where: { id: itemOrder.id },
  data: {
    order: itemOrder.order,
    columnId: data.columnId  // ⚠️ This overwrites columnId
  },
})
```

The API endpoint sets `columnId` on all items during reorder. If an item is being moved between columns at the same time:
- Race condition between move and reorder operations
- Items can end up in wrong columns

---

### 7. **Optimistic Update Doesn't Match Server Logic**
**Location**: `useBoardItemsStore.ts` lines 659-664

**Problem**:
```typescript
orderedItems.forEach((item, index) => {
  item.order = index;
  items.value.set(item.id, item);
});
```

Client sets `order = index`, but doesn't update `columnId`. Server updates both. This creates state mismatch.

---

### 8. **Abort Controller Limitation**
**Location**: `useBoardItemsStore.ts` lines 649-655

**Problem**:
Only ONE abort controller for the entire app:
```typescript
if (reorderInColumnAbortController) {
  reorderInColumnAbortController.abort();
}
```

If user reorders in Column A, then immediately reorders in Column B:
- Column A's request is aborted
- But Column A's optimistic update remains
- Column A never gets rolled back

**Should have**: Per-column abort controllers

---

## Recommended Fixes

### Priority 1: Fix Race Condition with Props
```typescript
// BoardColumn.vue
watch(
  () => props.items,
  (newItems) => {
    // Only sync if we're not actively reordering
    if (!reorderTimeout) {
      localItems.value = [...newItems];
    }
  },
  { immediate: true, deep: false } // Remove deep
);
```

### Priority 2: Remove Filtering from Reorder Chain
- Don't pass filtered items to BoardColumn
- OR: Pass both `items` (filtered, for display) and `allColumnItems` (for reorder)
- Reorder should always work with complete dataset

### Priority 3: Reduce Debounce
```typescript
reorderTimeout = setTimeout(() => {
  itemsStore.reorderItemsInColumn(props.columnId, newOrder);
}, 300); // Reduce from 800ms to 300ms
```

### Priority 4: Shallow Watch with Order Comparison
```typescript
watch(
  localItems,
  (newOrder, oldOrder) => {
    if (!oldOrder || oldOrder.length === 0 || newOrder.length !== oldOrder.length) {
      return;
    }
    
    // Only check if IDs order changed, not deep properties
    const orderChanged = newOrder.some(
      (item, index) => item.id !== oldOrder[index]?.id
    );
    
    if (orderChanged) {
      if (reorderTimeout) clearTimeout(reorderTimeout);
      reorderTimeout = setTimeout(() => {
        itemsStore.reorderItemsInColumn(props.columnId, newOrder);
      }, 300);
    }
  },
  { deep: false } // Change to shallow
);
```

### Priority 5: Server - Don't Update columnId During Reorder
```typescript
// server/api/board-items/reorder-in-column.patch.ts
prisma.boardItem.update({
  where: { id: itemOrder.id },
  data: {
    order: itemOrder.order,
    // Remove: columnId: data.columnId
  },
})
```

### Priority 6: Per-Column Abort Controllers
```typescript
// useBoardItemsStore.ts
const reorderAbortControllers = new Map<string, AbortController>();

const reorderItemsInColumn = async (columnId, orderedItems) => {
  const key = columnId ?? 'uncategorized';
  
  // Abort previous request for THIS column only
  if (reorderAbortControllers.has(key)) {
    reorderAbortControllers.get(key)?.abort();
  }
  
  const controller = new AbortController();
  reorderAbortControllers.set(key, controller);
  
  // ... rest of logic
};
```

### Priority 7: Add Loading State UI
Show a subtle indicator when reorder is in progress.

---

## Testing Checklist

After fixes, test these scenarios:
- [ ] Drag item within column with no filters
- [ ] Drag item with search filter active
- [ ] Drag item with tag filter active
- [ ] Rapid consecutive drags
- [ ] Drag in Column A, immediately drag in Column B
- [ ] Drag while offline
- [ ] Drag item, then move to different column before save completes
- [ ] Drag item, delete it before save completes
