<template>
  <UiSheet
    :open="open"
    :morph-name="MORPH_NAME"
    :morphing="morphing"
    @update:open="emit('update:open', $event)"
    @closed="emit('closed')"
  >
    <QuickNoteEditor
      v-if="open"
      :initial-title="title"
      :initial-content="content"
      @update:title="emit('update:title', $event)"
      @update:content="emit('update:content', $event)"
    />

    <template #footer>
      <div class="qns__footer">
        <UiButton
          variant="ghost"
          tone="neutral"
          leading-icon="i-lucide-maximize-2"
          :disabled="morphing"
          @click="emit('open-full')"
        >
          Open full note
        </UiButton>
        <UiButton
          pill
          tone="primary"
          :disabled="morphing"
          @click="emit('done')"
        >
          Done
        </UiButton>
      </div>
    </template>
  </UiSheet>
</template>

<script setup lang="ts">
/**
 * QuickNoteSheet — the notes page's quick-capture surface. Nothing exists
 * until the user types (lazy create — see useQuickNoteCapture); this sheet
 * just hosts the shared QuickNoteEditor. Deliberately lean: tags, note types,
 * groups, and AI live in the full editor ("Open full note").
 */
import QuickNoteEditor from "~/features/notes/components/QuickNoteEditor.vue";
import { MORPH_NAME } from "~/composables/ui/useViewTransitionMorph";

defineProps<{
  open: boolean;
  /** Seed values for the editor (applied once per open). */
  title: string;
  content: string;
  /** True while a view-transition morph drives the open/close (see UiSheet). */
  morphing?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "update:title", v: string): void;
  (e: "update:content", v: string): void;
  (e: "open-full"): void;
  (e: "done"): void;
  (e: "closed"): void;
}>();
</script>

<style scoped>
.qns__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
</style>
