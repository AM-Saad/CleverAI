<script setup lang="ts">
import WorkspaceImportDialog from "~/features/integrations/components/WorkspaceImportDialog.vue";
import { useBoardColumnsStore } from "../composables/useBoardColumnsStore";

const props = defineProps<{
  workspaceId: string;
}>();

const emit = defineEmits<{
  imported: [];
}>();

const columnsStore = useBoardColumnsStore(props.workspaceId);

const statusToColumnId = computed(() => {
  const columns = columnsStore.getOrderedColumns();
  const findColumn = (...needles: string[]) =>
    columns.find((column) => {
      const name = column.name.toLowerCase();
      return needles.some((needle) => name.includes(needle));
    })?.id ?? null;

  return {
    "To Do": findColumn("todo", "to do", "backlog", "task"),
    "In Progress": findColumn("progress", "doing"),
    Done: findColumn("done", "complete"),
  };
});
</script>

<template>
  <WorkspaceImportDialog
    :workspace-id="workspaceId"
    default-target="BOARD_ITEM"
    trigger-label="Apps"
    :status-to-column-id="statusToColumnId"
    @imported="emit('imported')"
  />
</template>
