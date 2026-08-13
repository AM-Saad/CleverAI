<template>
  <section class="action-section" aria-labelledby="actions-title">
    <div class="action-section__head">
      <div>
        <div class="action-section__title-row">
          <UiIcon name="action-items-sketch" size="20px" color="primary" />
          <UiTitle
            id="actions-title"
            class="unselectable"
            tag="h2"
            size="sm"
            :weight="'extrabold'"
            @click="isExpanded = !isExpanded"
            >Action items</UiTitle
          >
          <UiIconButton
            :icon="isExpanded ? 'chevron-down' : 'chevron-right'"
            :label="
              isExpanded ? 'Collapse action items' : 'Expand action items'
            "
            size="xs"
            variant="ghost"
            class="action-section__chevron-btn"
            @click="isExpanded = !isExpanded"
          />
        </div>
        <!-- <UiParagraph>{{ openCount }} open · {{ completedCount }} completed</UiParagraph> -->
      </div>
      <UiIconButton
        :icon="quickAddOpen ? 'x' : 'plus'"
        :label="quickAddOpen ? 'Close quick add' : 'Add action item'"
        size="sm"
        :pressed="quickAddOpen"
        @click="toggleQuickAdd"
      />
    </div>

    <template v-if="isExpanded">
      <Transition name="quick-add">
        <div v-if="quickAddOpen" class="quick-add">
          <div class="quick-add__inner">
            <div class="quick-add__content">
              <ActionItemQuickAddForm
                ref="quickAdd"
                :date-key="dateKey"
                @cancel="quickAddOpen = false"
              />
            </div>
          </div>
        </div>
      </Transition>

      <!-- Skeleton → list → empty are three hard cuts sitting directly under an
      animated form. Crossfading them keeps the region from popping while the
      form is still easing open. -->
      <Transition name="content-swap" mode="out-in">
        <DailyActionList
          v-if="items.length"
          key="list"
          :date-key="dateKey"
          :items="items"
          :conflicts="conflicts"
          :occurrence-conflicts="occurrenceConflicts"
          :resolving-action-item-id="resolvingActionItemId"
          :resolving-occurrence-id="resolvingOccurrenceId"
          @edit="quickAddOpen = false"
          @toggle="emit('toggle', $event.occurrenceKey, $event.completed)"
          @move="emit('move', $event)"
          @remove="emit('remove', $event)"
          @resolve-conflict="emit('resolve-conflict', $event)"
          @resolve-occurrence-conflict="
            emit('resolve-occurrence-conflict', $event)
          "
        />
        <ActionItemListSkeleton v-else-if="loading" key="skeleton" />
        <UiEmptyState
          v-else-if="!quickAddOpen"
          key="empty"
          icon="list"
          description="Plan something for this day, or leave it open."
        >
        </UiEmptyState>
      </Transition>

      <div
        v-if="orphanActionConflicts.length || orphanOccurrenceConflicts.length"
        class="action-section__conflicts"
      >
        <DailyActionConflictPanel
          v-for="conflict in orphanActionConflicts"
          :key="conflict.mutationId"
          :conflict="conflict"
          :resolving="resolvingActionItemId === conflict.actionItemId"
          @resolve="
            emit('resolve-conflict', {
              actionItemId: conflict.actionItemId,
              strategy: $event,
            })
          "
        />
        <DailyOccurrenceConflictPanel
          v-for="conflict in orphanOccurrenceConflicts"
          :key="conflict.mutationId"
          :conflict="conflict"
          :resolving="resolvingOccurrenceId === conflict.occurrenceId"
          @resolve="
            emit('resolve-occurrence-conflict', {
              occurrenceId: conflict.occurrenceId,
              strategy: $event,
            })
          "
        />
      </div>

      <!-- <div v-if="movedItems.length" class="moved-list">
        <UiLabel tag="p" size="sm" weight="bold" color="content-secondary" uppercase>Moved from this day</UiLabel>
        <div v-for="item in movedItems" :key="item.occurrenceKey" class="moved-row">
          <span>{{ item.title }}</span>
          <span>Moved to {{ item.movedDateLabel }}</span>
        </div>
      </div> -->
    </template>
  </section>
</template>

<script setup lang="ts">
import { useStorage } from "@vueuse/core";
import type { DailyActionConflict } from "../repositories/dailyLocalRepository";
import type { DailyOccurrenceConflict } from "../repositories/dailyLocalRepository";
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
import ActionItemListSkeleton from "~/features/daily/components/ActionItemListSkeleton.vue";
import ActionItemQuickAddForm from "~/features/daily/components/ActionItemQuickAddForm.vue";
import DailyActionList from "~/features/daily/components/DailyActionList.vue";
import DailyActionConflictPanel from "~/features/daily/components/DailyActionConflictPanel.vue";
import DailyOccurrenceConflictPanel from "~/features/daily/components/DailyOccurrenceConflictPanel.vue";
import UiIconButton from "~/components/ui/UiIconButton.vue";

const props = defineProps<{
  dateKey: string;
  items: readonly DailyActionViewModel[];
  movedItems: readonly DailyActionViewModel[];
  openCount: number;
  completedCount: number;
  loading: boolean;
  conflicts: readonly DailyActionConflict[];
  occurrenceConflicts: readonly DailyOccurrenceConflict[];
  resolvingActionItemId?: string | null;
  resolvingOccurrenceId?: string | null;
}>();
const emit = defineEmits<{
  toggle: [occurrenceKey: string, completed: boolean];
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

const isExpanded = useStorage("daily:action-section-expanded", true);
const quickAddOpen = ref(false);
const quickAdd = ref<InstanceType<typeof ActionItemQuickAddForm> | null>(null);
const visibleActionItemIds = computed(
  () => new Set(props.items.map((item) => item.actionItemId)),
);
const visibleOccurrenceKeys = computed(
  () => new Set(props.items.map((item) => item.occurrenceKey)),
);
const orphanActionConflicts = computed(() =>
  props.conflicts.filter(
    (conflict) => !visibleActionItemIds.value.has(conflict.actionItemId),
  ),
);
const orphanOccurrenceConflicts = computed(() =>
  props.occurrenceConflicts.filter(
    (conflict) => !visibleOccurrenceKeys.value.has(conflict.occurrenceKey),
  ),
);

watch(
  () => props.dateKey,
  () => {
    quickAddOpen.value = false;
  },
);

function toggleQuickAdd() {
  quickAddOpen.value = !quickAddOpen.value;
  if (quickAddOpen.value) {
    isExpanded.value = true;
    nextTick(() => quickAdd.value?.focus());
  }
}
</script>

<style scoped>
.action-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.action-section__head,
.action-section__title-row,
.moved-row {
  display: flex;
  align-items: center;
}

.action-section__head {
  justify-content: space-between;
}

.action-section__title-row {
  gap: var(--space-2);
}

.action-section__conflicts {
  display: grid;
  gap: var(--space-2);
}

/* Height-animated collapse (see ActionItemQuickAddForm for the full rationale).
   This one matters most: the entire action list sits directly below the form,
   so a paint-only reveal makes every row jump the form's full height on the
   first frame.

   The negative margin cancels the section's flex gap, which is not part of any
   child's box and would otherwise survive the collapse and disappear in one
   frame on unmount. The replacement spacing goes on `__content`, *inside* the
   clip — padding on `__inner` itself can't shrink below its own size, so the
   box would bottom out at 12px and drop that in a single step. */
.quick-add {
  display: grid;
  grid-template-rows: 1fr;
  margin-block-start: calc(-1 * var(--space-3));
}

.quick-add__inner {
  min-height: 0;
  overflow: hidden;
}

.quick-add__content {
  padding-block-start: var(--space-3);
}

/* Same declared duration both ways, but they are not symmetric in practice.
   `fr` units are nonlinear in pixels: the open uses its full 320ms, while a
   collapse of this height reaches zero at ~70% of the clock — so 320ms out is
   ~225ms of real movement, roughly the 70% of the entrance that a close wants.
   Measured, not guessed. The curve is what fixes the roughness: on
   `--ease-exit` the list it releases rises at one steady rate, where
   `--ease-standard` dumped most of the travel into the first few frames. */
.quick-add-enter-active {
  transition:
    grid-template-rows var(--duration-slow) var(--ease-standard),
    opacity var(--duration-normal) var(--ease-standard) 60ms;
}

.quick-add-leave-active {
  transition:
    grid-template-rows var(--duration-slow) var(--ease-exit),
    opacity var(--duration-normal) var(--ease-exit);
}

.quick-add-enter-from,
.quick-add-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

/* Plain crossfade — these three states have very different heights, so any
   travel on top of the height change reads as a lurch. */
.content-swap-enter-active {
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.content-swap-leave-active {
  transition: opacity 90ms var(--ease-exit);
}

.content-swap-enter-from,
.content-swap-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .quick-add-enter-active,
  .quick-add-leave-active,
  .content-swap-enter-active,
  .content-swap-leave-active {
    transition-duration: 0.01ms;
    transition-delay: 0ms;
  }
}

/* .action-section__head p {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
} */

/* .action-section__head :deep(h2) {
  font-size: var(--text-lg);
} */

.moved-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-left: 3px solid var(--color-secondary);
}

.moved-row {
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-content-disabled);
  font-size: var(--text-sm);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
</style>
