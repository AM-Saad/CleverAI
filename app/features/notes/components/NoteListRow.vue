<template>
  <UiItemCard
    as="li"
    clickable
    size="sm"
    :spine="spine"
    :show-body="Boolean(snippet)"
    @click="emit('open', note.id)"
  >
    <template #title>
      <span dir="auto">{{ title }}</span>
    </template>
    <template #actions>
      <SyncBadge :state="note.isDirty ? 'local' : 'synced'" />
    </template>

    <p v-if="snippet" class="note-row__snippet" dir="auto">{{ snippet }}</p>

    <template #footer>
      <UiPill
        v-if="cardCount"
        size="sm"
        :label="`${cardCount} cards`"
        color="var(--color-content-secondary)"
        max-width="92px"
      >
        <template #icon>
          <UiPillIcon name="i-lucide-layers" size="sm" />
        </template>
      </UiPill>
      <UiPill
        v-if="note.noteType === 'MATH'"
        size="sm"
        label="∑ math"
        color="var(--color-success)"
        variant="outline"
        active
        max-width="92px"
      />
      <UiPill
        v-if="note.noteType === 'CANVAS'"
        size="sm"
        label="✎ canvas"
        color="var(--color-accent-orange)"
        variant="outline"
        active
        max-width="96px"
      />
      <span class="note-row__time">{{ edited }}</span>
    </template>
  </UiItemCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { NoteState } from "~/features/notes/composables/useNotesStore";
import { noteSpineVar } from "~/composables/useAccentColor";
import SyncBadge from "~/components/shell/SyncBadge.vue";

const props = defineProps<{ note: NoteState }>();
const emit = defineEmits<{ (e: "open", id: string): void }>();

const spine = computed(() => noteSpineVar(props.note.noteType));
const title = computed(
  () =>
    props.note.title?.trim() ||
    firstLine(props.note.content) ||
    "Untitled note",
);

const snippet = computed(() => {
  const text = stripHtml(props.note.content);
  const t = props.note.title?.trim();
  // Avoid repeating the title in the snippet.
  const body = t && text.startsWith(t) ? text.slice(t.length) : text;
  return body.trim().slice(0, 120);
});

const cardCount = computed(() => {
  const meta = props.note.metadata as Record<string, unknown> | undefined;
  const c = meta?.cardCount;
  return typeof c === "number" && c > 0 ? c : null;
});

const edited = computed(() => `edited ${relativeTime(props.note.updatedAt)}`);

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function firstLine(html: string): string {
  return stripHtml(html).slice(0, 60);
}
function relativeTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}
</script>

<style scoped>
.note-row__snippet {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--color-content-secondary);
}
.note-row__time {
  margin-left: auto;
}
</style>
