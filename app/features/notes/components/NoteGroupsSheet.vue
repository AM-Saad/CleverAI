<template>
  <UiSheet :open="open" title="Groups" @update:open="emit('update:open', $event)">
    <div class="ngs">
      <ul v-if="draft.length" class="ngs__list">
        <li v-for="(g, i) in draft" :key="g.id" class="ngs__row">
          <div class="ngs__reorder">
            <button type="button" class="ngs__move" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)"> <!-- design-allow: native reorder control -->
              <UiIcon name="i-lucide-chevron-up" class="h-4 w-4" />
            </button>
            <button type="button" class="ngs__move" :disabled="i === draft.length - 1" aria-label="Move down" @click="move(i, 1)"> <!-- design-allow: native reorder control -->
              <UiIcon name="i-lucide-chevron-down" class="h-4 w-4" />
            </button>
          </div>
          <span class="ngs__dot" :style="{ background: dotFor(g.id) }" />
          <input v-model="g.title" class="ngs__name" :placeholder="`Group ${i + 1}`" @change="onRename(g)" /> <!-- design-allow: native rename field -->
          <UiDoubleTapDeleteButton
            unstyled
            hide-label
            class="ngs__del"
            :aria-label="`Delete ${g.title}`"
            :title="`Delete ${g.title}`"
            :armed-label="`Tap again to delete ${g.title}`"
            :reset-key="g.id"
            @confirm="onDelete(g)"
          >
            <UiIcon name="i-lucide-trash-2" class="h-[18px] w-[18px]" />
          </UiDoubleTapDeleteButton>
        </li>
      </ul>
      <p v-else class="ngs__empty">No groups yet. Create one to organise your notes into sections.</p>

      <div v-if="adding" class="ngs__add-row">
        <input ref="addEl" v-model="newName" class="ngs__name ngs__name--add" placeholder="New group name" @keydown.enter.prevent="commitAdd" /> <!-- design-allow: native add field -->
        <UiButton pill size="sm" tone="primary" :loading="busy" :disabled="!newName.trim()" @click="commitAdd">Add</UiButton>
      </div>
      <button v-else type="button" class="ngs__add" @click="startAdd"> <!-- design-allow: native dashed add control -->
        <UiIcon name="i-lucide-plus" class="h-4 w-4" /> New group
      </button>
    </div>
  </UiSheet>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { accentVarFor } from "~/composables/useAccentColor";

interface GroupLike { id: string; title: string }

const props = defineProps<{
  open: boolean;
  groups: GroupLike[];
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "create", title: string): Promise<void> | void;
  (e: "rename", payload: { id: string; title: string }): void;
  (e: "delete", id: string): void;
  (e: "reorder", ordered: GroupLike[]): void;
}>();

// Local editable copy so reorder/rename feel instant; parent persists on events.
const draft = ref<GroupLike[]>([]);
watch(
  () => [props.open, props.groups] as const,
  ([open]) => {
    if (open) draft.value = props.groups.map((g) => ({ id: g.id, title: g.title }));
  },
  { immediate: true, deep: true },
);

function dotFor(id: string) {
  return accentVarFor(id);
}
function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= draft.value.length) return;
  const next = draft.value.slice();
  [next[i], next[j]] = [next[j]!, next[i]!];
  draft.value = next;
  emit("reorder", next.map((g) => ({ id: g.id, title: g.title })));
}
function onRename(g: GroupLike) {
  const title = g.title.trim();
  if (title) emit("rename", { id: g.id, title });
}
function onDelete(g: GroupLike) {
  emit("delete", g.id);
  draft.value = draft.value.filter((x) => x.id !== g.id);
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
  const title = newName.value.trim();
  if (!title || busy.value) return;
  busy.value = true;
  try {
    await emit("create", title);
    adding.value = false;
    newName.value = "";
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.ngs {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}
.ngs__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}
.ngs__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-xl);
  background: var(--color-surface-subtle);
}
.ngs__reorder {
  display: flex;
  flex-direction: column;
}
.ngs__move {
  display: grid;
  place-items: center;
  width: 26px;
  height: 20px;
  color: var(--color-content-secondary);
}
.ngs__move:disabled {
  opacity: 0.3;
}
.ngs__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.ngs__name {
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
.ngs__name:focus {
  border-color: var(--color-primary);
}
.ngs__name--add {
  border-color: var(--color-primary);
}
.ngs__del {
  display: grid;
  place-items: center;
  width: var(--target-touch);
  height: var(--target-touch);
  border-radius: var(--radius-full);
  color: var(--color-error-text);
  flex-shrink: 0;
}
.ngs__del:active {
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
}
.ngs__empty {
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--color-content-secondary);
  padding: var(--space-2) 0;
}
.ngs__add-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ngs__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  border: 1.5px dashed var(--color-border-strong);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
}
.ngs__add:active {
  background: var(--color-surface-subtle);
}
</style>
