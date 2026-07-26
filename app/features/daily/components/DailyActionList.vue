<template>
  <div class="action-list">
    <template v-for="item in items" :key="item.occurrenceKey">
      <ActionItemInlineForm
        v-if="editingKey === item.occurrenceKey"
        :date-key="dateKey"
        :item="item"
        @cancel="editingKey = null"
        @saved="editingKey = null"
      />
      <DailyActionRow
        v-else
        :item="item"
        @toggle="
          $emit('toggle', {
            occurrenceKey: item.occurrenceKey,
            completed: $event,
          })
        "
        @edit="startEdit(item.occurrenceKey)"
        @move="$emit('move', item.occurrenceKey)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
import ActionItemInlineForm from "~/features/daily/components/ActionItemInlineForm.vue";
import DailyActionRow from "~/features/daily/components/DailyActionRow.vue";

const props = defineProps<{
  dateKey: string;
  items: readonly DailyActionViewModel[];
}>();
const emit = defineEmits<{
  edit: [];
  toggle: [payload: { occurrenceKey: string; completed: boolean }];
  move: [occurrenceKey: string];
}>();
const editingKey = ref<string | null>(null);

function startEdit(occurrenceKey: string) {
  editingKey.value = occurrenceKey;
  emit("edit");
}

watch(
  () => props.dateKey,
  () => {
    editingKey.value = null;
  },
);
</script>

<style scoped>
.action-list {
  overflow: hidden;
  /* background: var(--color-surface-subtle); */
}
</style>
