<template>
  <div class="action-list">
    <template v-for="item in items" :key="item.occurrenceKey">
      <!-- out-in so the row and the editor never occupy the list at the same
      time — overlapping them makes the whole list jump by the height
      difference mid-swap. -->
      <Transition name="row-swap" mode="out-in">
        <ActionItemRowEditor
          v-if="editingKey === item.occurrenceKey"
          :date-key="dateKey"
          :item="item"
          @cancel="editingKey = null"
          @saved="editingKey = null"
        />
        <DailyActionRow
          v-else
          :item="item"
          :conflicted="Boolean(conflictByActionItemId[item.actionItemId])"
          @toggle="
            $emit('toggle', {
              occurrenceKey: item.occurrenceKey,
              completed: $event,
            })
          "
          @edit="startEdit(item.occurrenceKey)"
          @move="$emit('move', item.occurrenceKey)"
          @remove="$emit('remove', item.occurrenceKey)"
        />
      </Transition>
      <DailyActionConflictPanel
        v-if="conflictByActionItemId[item.actionItemId]"
        :conflict="conflictByActionItemId[item.actionItemId]!"
        :resolving="resolvingActionItemId === item.actionItemId"
        @resolve="
          $emit('resolve-conflict', {
            actionItemId: item.actionItemId,
            strategy: $event,
          })
        "
      />
      <DailyOccurrenceConflictPanel
        v-if="occurrenceConflictByKey[item.occurrenceKey]"
        :conflict="occurrenceConflictByKey[item.occurrenceKey]!"
        :resolving="
          resolvingOccurrenceId ===
          occurrenceConflictByKey[item.occurrenceKey]!.occurrenceId
        "
        @resolve="
          $emit('resolve-occurrence-conflict', {
            occurrenceId:
              occurrenceConflictByKey[item.occurrenceKey]!.occurrenceId,
            strategy: $event,
          })
        "
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DailyActionConflict } from "../repositories/dailyLocalRepository";
import type { DailyOccurrenceConflict } from "../repositories/dailyLocalRepository";
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
import DailyActionConflictPanel from "~/features/daily/components/DailyActionConflictPanel.vue";
import DailyOccurrenceConflictPanel from "~/features/daily/components/DailyOccurrenceConflictPanel.vue";
import ActionItemRowEditor from "~/features/daily/components/ActionItemRowEditor.vue";
import DailyActionRow from "~/features/daily/components/DailyActionRow.vue";

const props = defineProps<{
  dateKey: string;
  items: readonly DailyActionViewModel[];
  conflicts: readonly DailyActionConflict[];
  occurrenceConflicts: readonly DailyOccurrenceConflict[];
  resolvingActionItemId?: string | null;
  resolvingOccurrenceId?: string | null;
}>();
const emit = defineEmits<{
  edit: [];
  toggle: [payload: { occurrenceKey: string; completed: boolean }];
  move: [occurrenceKey: string];
  remove: [occurrenceKey: string];
  "resolve-conflict": [
    payload: {
      actionItemId: string;
      strategy: "keep-local" | "keep-server";
    },
  ];
  "resolve-occurrence-conflict": [
    payload: {
      occurrenceId: string;
      strategy: "keep-local" | "keep-server";
    },
  ];
}>();
const editingKey = ref<string | null>(null);
const conflictByActionItemId = computed<Record<string, DailyActionConflict>>(
  () =>
    Object.fromEntries(
      props.conflicts.map((conflict) => [conflict.actionItemId, conflict]),
    ),
);
const occurrenceConflictByKey = computed<
  Record<string, DailyOccurrenceConflict>
>(() =>
  Object.fromEntries(
    props.occurrenceConflicts.map((conflict) => [
      conflict.occurrenceKey,
      conflict,
    ]),
  ),
);

function startEdit(occurrenceKey: string) {
  const item = props.items.find((row) => row.occurrenceKey === occurrenceKey);
  if (item && conflictByActionItemId.value[item.actionItemId]) return;
  editingKey.value = occurrenceKey;
  emit("edit");
}

watch(
  () => props.dateKey,
  () => {
    editingKey.value = null;
  },
);

watch(
  () => props.conflicts,
  () => {
    const item = props.items.find(
      (row) => row.occurrenceKey === editingKey.value,
    );
    if (item && conflictByActionItemId.value[item.actionItemId])
      editingKey.value = null;
  },
  { deep: true },
);
</script>

<style scoped>
.action-list {
  overflow: hidden;
  /* background: var(--color-surface-subtle); */
}

/* Row ⇄ editor swap. Fires on every edit tap, so it stays short and flat.
 *
 * No transform on purpose: the row and the editor are different heights, so the
 * swap already moves everything below it. A scale on top of that reads as a
 * wobble, and sub-pixel scaling blurs the title mid-transition. A plain
 * crossfade is the one thing that doesn't fight the height change.
 *
 * Leave is shorter than enter. `out-in` runs the two phases back to back, so
 * their sum is what the finger feels — trimming the outgoing half keeps the tap
 * responsive while the incoming editor still gets a soft landing. */
.row-swap-enter-active {
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.row-swap-leave-active {
  transition: opacity 90ms var(--ease-exit);
}

.row-swap-enter-from,
.row-swap-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .row-swap-enter-active,
  .row-swap-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
