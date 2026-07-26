<template>
  <section class="action-section" aria-labelledby="actions-title">
    <div class="action-section__head">
      <div>
        <div class="action-section__title-row">
          <UiTitle id="actions-title" tag="h2" size="base"
            >Action items</UiTitle
          >
          <UiIconButton
            :icon="
              isExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'
            "
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
        :icon="quickAddOpen ? 'i-lucide-x' : 'i-lucide-plus'"
        :label="quickAddOpen ? 'Close quick add' : 'Add action item'"
        size="sm"
        :pressed="quickAddOpen"
        @click="toggleQuickAdd"
      />
    </div>

    <template v-if="isExpanded">
      <ActionItemInlineForm
        v-if="quickAddOpen"
        ref="quickAdd"
        :date-key="dateKey"
        @cancel="quickAddOpen = false"
      />

      <DailyActionList
        v-if="items.length"
        :date-key="dateKey"
        :items="items"
        @edit="quickAddOpen = false"
        @toggle="emit('toggle', $event.occurrenceKey, $event.completed)"
        @move="emit('move', $event)"
      />
      <ActionItemListSkeleton v-else-if="loading" />
      <UiEmptyState
        v-else-if="!quickAddOpen"
        icon="i-lucide-list"
        description="Plan something for this day, or leave it open."
      >
      </UiEmptyState>

      <div v-if="movedItems.length" class="moved-list">
        <UiLabel
          tag="p"
          size="sm"
          weight="bold"
          color="content-secondary"
          uppercase
          >Moved from this day</UiLabel
        >
        <div
          v-for="item in movedItems"
          :key="item.occurrenceKey"
          class="moved-row"
        >
          <span>{{ item.title }}</span>
          <span>Moved to {{ item.movedDateLabel }}</span>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useStorage } from "@vueuse/core";
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
import ActionItemListSkeleton from "~/features/daily/components/ActionItemListSkeleton.vue";
import ActionItemInlineForm from "~/features/daily/components/ActionItemInlineForm.vue";
import DailyActionList from "~/features/daily/components/DailyActionList.vue";
import UiIconButton from "~/components/ui/UiIconButton.vue";

const props = defineProps<{
  dateKey: string;
  items: readonly DailyActionViewModel[];
  movedItems: readonly DailyActionViewModel[];
  openCount: number;
  completedCount: number;
  loading: boolean;
}>();
const emit = defineEmits<{
  toggle: [occurrenceKey: string, completed: boolean];
  move: [occurrenceKey: string];
}>();

const isExpanded = useStorage("daily:action-section-expanded", true);
const quickAddOpen = ref(false);
const quickAdd = ref<InstanceType<typeof ActionItemInlineForm> | null>(null);

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
  gap: var(--space-1);
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
}
</style>
