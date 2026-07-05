<template>
  <UiSheet
    :open="open"
    :title="isCreate ? 'New card' : 'Edit card'"
    @update:open="emit('update:open', $event)"
  >
    <div class="bcs">
      <label class="bcs__label">CARD</label>
      <div
        ref="bodyEl"
        class="bcs__body tiptap"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        data-placeholder="What needs doing?"
        @input="onBodyInput"
      />
      <!-- design-allow: native rich-text card body -->
      <nav class="bcs__format" aria-label="Formatting">
        <button v-for="f in FORMATS" :key="f.cmd" type="button" class="bcs__fmt" :aria-label="f.label" @mousedown.prevent="runFormat(f.cmd)"> <!-- design-allow: native formatting controls -->
          <UiIcon v-if="f.icon" :name="f.icon" class="h-[18px] w-[18px]" />
          <span v-else>{{ f.glyph }}</span>
        </button>
      </nav>

      <label class="bcs__label">COLUMN</label>
      <div class="bcs__cols">
        <UiPill
          v-for="c in columns"
          :key="c.id"
          clickable
          selectable
          variant="outline"
          color="var(--color-primary)"
          :active="columnId === c.id"
          :label="c.name"
          max-width="170px"
          @click="columnId = c.id"
        />
      </div>

      <label class="bcs__label">TAGS</label>
      <div class="bcs__tags">
        <UiPill
          v-for="t in tags"
          :key="t.id"
          clickable
          selectable
          :variant="selected.has(t.id) ? 'fill' : 'outline'"
          :active="selected.has(t.id)"
          :label="t.name"
          :color="tagColor(t)"
          size="sm"
          max-width="150px"
          @click="toggleTag(t.id)"
        />
        <UiPill
          v-if="!addingTag"
          clickable
          size="sm"
          label="New tag"
          icon="i-lucide-plus"
          color="var(--color-content-secondary)"
          variant="dashed"
          max-width="120px"
          @click="startAddTag"
        />
      </div>

      <!-- new-tag composer -->
      <div v-if="addingTag" class="bcs__newtag">
        <input ref="tagNameEl" v-model="newTagName" class="bcs__newtag-input" placeholder="Tag name" maxlength="50" @keydown.enter.prevent="commitNewTag" /> <!-- design-allow: native tag-name field -->
        <div class="bcs__swatches">
          <button v-for="c in ACCENT_TOKENS" :key="c" type="button" class="bcs__swatch" :class="{ 'bcs__swatch--on': newTagColor === c }" :style="{ background: `var(${c})` }" :aria-label="`Color ${c}`" @click="newTagColor = c" /> <!-- design-allow: native color swatch -->
        </div>
        <div class="bcs__newtag-actions">
          <button type="button" class="bcs__newtag-cancel" @click="cancelAddTag"> <!-- design-allow: native inline action -->
            Cancel
          </button>
          <UiButton
            pill
            size="sm"
            tone="primary"
            :loading="creatingTag"
            :disabled="!newTagName.trim()"
            @click="commitNewTag"
            >Create</UiButton
          >
        </div>
      </div>

      <label class="bcs__label">DUE DATE</label>
      <UiInput v-model="due" type="date" />
    </div>

    <template #footer>
      <div class="bcs__footer">
        <UiDoubleTapDeleteButton
          v-if="!isCreate"
          unstyled
          class="bcs__delete"
          label="Delete"
          armed-label="Tap again"
          :reset-key="props.item?.id ?? null"
          @confirm="emit('delete')"
        >
          <template #default="{ label }">
            <UiIcon name="i-lucide-trash-2" class="h-4 w-4" /> {{ label }}
          </template>
        </UiDoubleTapDeleteButton>
        <UiButton
          pill
          block
          tone="primary"
          :disabled="!hasContent"
          @click="onSave"
        >
          {{ isCreate ? "Add card" : "Save" }}
        </UiButton>
      </div>
    </template>
  </UiSheet>
</template>

<script setup lang="ts">
/**
 * BoardCardSheet — the card's edit surface (the kanban "verbs" on mobile):
 * edit content (rich text), move between columns, assign/create tags, set due,
 * delete. A move-selector is more reliable on a phone than dragging between
 * paged columns.
 */
import { ref, computed, watch, nextTick } from "vue";
import type { UserTagState } from "~/composables/tags/useUserTagsStore";
import { tagColorVar, ACCENT_TOKENS } from "~/composables/useAccentColor";

interface ColumnLike {
  id: string;
  name: string;
}
interface ItemLike {
  id: string;
  content: string;
  tags?: string[];
  columnId?: string | null;
  dueDate?: string | Date | null;
}

const props = defineProps<{
  open: boolean;
  item: ItemLike | null;
  columns: ColumnLike[];
  tags: UserTagState[];
  defaultColumnId?: string | null;
  /** Create a tag and return its id (owned by the parent's tags store). */
  createTag: (name: string, colorToken: string) => Promise<string | null>;
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (
    e: "save",
    payload: {
      content: string;
      tags: string[];
      columnId: string | null;
      dueDate: string | null;
    },
  ): void;
  (e: "delete"): void;
}>();

const isCreate = computed(() => !props.item);

type FormatAction = {
  cmd: "bold" | "italic" | "insertUnorderedList";
  label: string;
  glyph?: string;
  icon?: string;
};

const FORMATS: FormatAction[] = [
  { cmd: "bold", label: "Bold", glyph: "B" },
  { cmd: "italic", label: "Italic", glyph: "I" },
  { cmd: "insertUnorderedList", label: "List", icon: "i-lucide-list" },
];

const bodyEl = ref<HTMLElement | null>(null);
const contentHtml = ref("");
const columnId = ref<string | null>(null);
const due = ref("");
const selected = ref<Set<string>>(new Set());

const hasContent = computed(
  () => contentHtml.value.replace(/<[^>]*>/g, "").trim().length > 0,
);

// ── New tag composer (declared before the watch — the immediate run resets it) ─
const addingTag = ref(false);
const newTagName = ref("");
const newTagColor = ref<string>(ACCENT_TOKENS[0]);
const creatingTag = ref(false);
const tagNameEl = ref<HTMLInputElement | null>(null);

function startAddTag() {
  addingTag.value = true;
  newTagName.value = "";
  newTagColor.value = ACCENT_TOKENS[0];
  nextTick(() => tagNameEl.value?.focus());
}
function cancelAddTag() {
  addingTag.value = false;
  newTagName.value = "";
}
async function commitNewTag() {
  const name = newTagName.value.trim();
  if (!name || creatingTag.value) return;
  creatingTag.value = true;
  try {
    const id = await props.createTag(name, newTagColor.value);
    if (id) {
      const next = new Set(selected.value);
      next.add(id);
      selected.value = next;
    }
    cancelAddTag();
  } finally {
    creatingTag.value = false;
  }
}

watch(
  () => [props.open, props.item] as const,
  ([open]) => {
    if (!open) {
      cancelAddTag();
      return;
    }
    contentHtml.value = props.item?.content ?? "";
    columnId.value =
      props.item?.columnId ??
      props.defaultColumnId ??
      props.columns[0]?.id ??
      null;
    due.value = props.item?.dueDate
      ? new Date(props.item.dueDate).toISOString().slice(0, 10)
      : "";
    selected.value = new Set(props.item?.tags ?? []);
    // Paint the contenteditable once it's in the DOM.
    nextTick(() => {
      if (bodyEl.value) bodyEl.value.innerHTML = contentHtml.value;
    });
  },
  { immediate: true },
);

function onBodyInput() {
  contentHtml.value = bodyEl.value?.innerHTML ?? "";
}
function runFormat(cmd: string) {
  document.execCommand(cmd);
  onBodyInput();
}

function tagColor(t: UserTagState) {
  return tagColorVar({ name: t.name, color: t.color ?? null });
}
function toggleTag(id: string) {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selected.value = next;
}

function onSave() {
  emit("save", {
    content: contentHtml.value,
    tags: [...selected.value],
    columnId: columnId.value,
    dueDate: due.value ? new Date(due.value).toISOString() : null,
  });
}
</script>

<style scoped>
.bcs {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}
.bcs__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
  margin-top: var(--space-3);
}
.bcs__body {
  min-height: 76px;
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: var(--color-surface-subtle);
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-content-on-surface);
  outline: none;
}
.bcs__body:empty::before {
  content: attr(data-placeholder);
  color: var(--color-content-disabled);
}
.bcs__format {
  display: flex;
  gap: var(--space-2);
  margin-top: 6px;
}
.bcs__fmt {
  display: grid;
  place-items: center;
  width: 38px;
  height: 34px;
  border-radius: var(--radius-lg);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-content-on-surface);
  background: var(--color-surface-subtle);
}
.bcs__fmt:active {
  background: var(--color-secondary);
}
.bcs__cols {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.bcs__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.bcs__newtag {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: var(--color-surface-subtle);
}
.bcs__newtag-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-primary);
  background: var(--color-background);
  font-size: 14px;
  color: var(--color-content-on-surface-strong);
  outline: none;
}
.bcs__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.bcs__swatch {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
}
.bcs__swatch--on {
  border-color: var(--color-content-on-surface-strong);
  transform: scale(1.1);
}
.bcs__newtag-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}
.bcs__newtag-cancel {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-content-secondary);
}
.bcs__footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.bcs__delete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-error-text);
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
  flex-shrink: 0;
}
</style>
