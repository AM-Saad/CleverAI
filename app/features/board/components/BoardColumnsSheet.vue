<template>
  <UiSheet
    :open="open"
    title="Columns"
    @update:open="emit('update:open', $event)"
  >
    <div class="bcols">
      <ul class="bcols__list">
        <li v-for="(col, i) in draft" :key="col.id" class="bcols__row">
          <div class="bcols__reorder">
            <button type="button" class="bcols__move" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)"> <!-- design-allow: native reorder control -->
              <UiIcon name="i-lucide-chevron-up" class="h-4 w-4" />
            </button>
            <button type="button" class="bcols__move" :disabled="i === draft.length - 1" aria-label="Move down" @click="move(i, 1)"> <!-- design-allow: native reorder control -->
              <UiIcon name="i-lucide-chevron-down" class="h-4 w-4" />
            </button>
          </div>
          <input v-model="col.name" class="bcols__name" :placeholder="`Column ${i + 1}`" @change="onRename(col)" /> <!-- design-allow: native rename field -->
          <UiDoubleTapDeleteButton
            unstyled
            hide-label
            class="bcols__del"
            :aria-label="`Delete ${col.name}`"
            :title="`Delete ${col.name}`"
            :armed-label="`Tap again to delete ${col.name}`"
            :reset-key="col.id"
            @confirm="onDelete(col)"
          >
            <UiIcon name="i-lucide-trash-2" class="h-[18px] w-[18px]" />
          </UiDoubleTapDeleteButton>
        </li>
      </ul>

      <div v-if="adding" class="bcols__add-row">
        <input ref="addEl" v-model="newName" class="bcols__name bcols__name--add" placeholder="New column name" @keydown.enter.prevent="commitAdd" /> <!-- design-allow: native add field -->
        <UiButton
          size="sm"
          tone="primary"
          :loading="busy"
          :disabled="!newName.trim()"
          @click="commitAdd"
          >Add</UiButton
        >
      </div>
      <UiPill
        v-else
        clickable
        label="Add column"
        icon="i-lucide-plus"
        color="var(--color-primary)"
        variant="dashed"
        class-name="bcols__add"
        max-width="100%"
        @click="startAdd"
      />
    </div>
  </UiSheet>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";

interface ColumnLike {
  id: string;
  name: string;
}

const props = defineProps<{
  open: boolean;
  columns: ColumnLike[];
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "create", name: string): Promise<void> | void;
  (e: "rename", payload: { id: string; name: string }): void;
  (e: "delete", id: string): void;
  (e: "reorder", ordered: ColumnLike[]): void;
}>();

// Local editable copy so reorder/rename feel instant; parent persists on events.
const draft = ref<ColumnLike[]>([]);
watch(
  () => [props.open, props.columns] as const,
  ([open]) => {
    if (open)
      draft.value = props.columns.map((c) => ({ id: c.id, name: c.name }));
  },
  { immediate: true, deep: true },
);

function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= draft.value.length) return;
  const next = draft.value.slice();
  [next[i], next[j]] = [next[j]!, next[i]!];
  draft.value = next;
  emit(
    "reorder",
    next.map((c) => ({ id: c.id, name: c.name })),
  );
}
function onRename(col: ColumnLike) {
  const name = col.name.trim();
  if (name) emit("rename", { id: col.id, name });
}
function onDelete(col: ColumnLike) {
  emit("delete", col.id);
  draft.value = draft.value.filter((c) => c.id !== col.id);
}

const adding = ref(false);
const newName = ref("");
const busy = ref(false);
const addEl = ref<HTMLInputElement | null>(null);
function startAdd() {
  adding.value = true;
  newName.value = "";
  nextTick(() => addEl.value?.focus());
}
async function commitAdd() {
  const name = newName.value.trim();
  if (!name || busy.value) return;
  busy.value = true;
  try {
    await emit("create", name);
    adding.value = false;
    newName.value = "";
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.bcols {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}
.bcols__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}
.bcols__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-xl);
  background: var(--color-surface-subtle);
}
.bcols__reorder {
  display: flex;
  flex-direction: column;
}
.bcols__move {
  display: grid;
  place-items: center;
  width: 26px;
  height: 20px;
  color: var(--color-content-secondary);
}
.bcols__move:disabled {
  opacity: 0.3;
}
.bcols__name {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  background: var(--color-background);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-content-on-surface-strong);
  outline: none;
}
.bcols__name:focus {
  border-color: var(--color-primary);
}
.bcols__name--add {
  flex: 1;
  border-color: var(--color-primary);
}
.bcols__del {
  display: grid;
  place-items: center;
  width: var(--target-touch);
  height: var(--target-touch);
  border-radius: var(--radius-full);
  color: var(--color-error-text);
  flex-shrink: 0;
}
.bcols__del:active {
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
}
.bcols__add-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.bcols__add {
  justify-content: center;
  width: 100%;
}
</style>
