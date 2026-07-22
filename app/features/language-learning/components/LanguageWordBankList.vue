<template>
  <div v-if="loading && !rows.length" class="word-bank-list">
    <UiSkeleton
      v-for="index in 5"
      :key="index"
      class="h-14 w-full rounded-[var(--component-card-radius)]"
    />
  </div>
  <UiAlert
    v-else-if="error"
    tone="error"
    title="Couldn't load words"
    :description="error"
  />
  <UiEmptyState
    v-else-if="!rows.length"
    icon="i-lucide-book-open"
    title="No words yet"
    :description="emptyMessage"
  />
  <template v-else>
    <ul class="word-bank-list">
      <li
        v-for="row in rows"
        :key="row.word.id"
        class="word-bank-list__row"
        :style="{ '--word-accent': row.accent }"
      >
        <UiButton
          tone="neutral"
          variant="link"
          class="word-bank-list__open"
          :aria-label="`Open details for ${row.word.word}`"
          @click="$emit('open', row.word)"
        >
          <span class="word-bank-list__main">
            <span class="word-bank-list__word">{{ row.word.word }}</span>
            <span class="word-bank-list__gloss">
              {{ row.word.translation
              }}<template v-if="row.word.partOfSpeech">
                · {{ row.word.partOfSpeech }}</template
              >
            </span>
          </span>
          <UiIcon
            name="i-lucide-chevron-right"
            class="h-4 w-4 shrink-0 text-primary"
          />
        </UiButton>
        <UiPill
          size="sm"
          :label="row.badgeLabel"
          :color="row.badgeColor"
          variant="outline"
          active
          max-width="100px"
        />
        <div class="word-bank-list__actions" @click.stop>
          <UiButton
            size="xs"
            variant="soft"
            :disabled="row.reviewDisabled"
            @click="$emit('enroll', row.word)"
          >
            {{ row.reviewLabel }}
          </UiButton>
          <UiDoubleTapDeleteButton
            unstyled
            class="word-bank-list__delete"
            :label="deletingId === row.word.id ? 'Deleting…' : 'Delete'"
            armed-label="Tap again"
            :loading="deletingId === row.word.id"
            :disabled="Boolean(deletingId && deletingId !== row.word.id)"
            :reset-key="row.word.id"
            @confirm="$emit('delete', row.word)"
          />
        </div>
      </li>
    </ul>
    <UiButton
      v-if="hasMore"
      block
      tone="neutral"
      variant="soft"
      :loading="loadingMore"
      @click="$emit('load-more')"
    >
      Load more words
    </UiButton>
  </template>
</template>

<script setup lang="ts">
import type { LanguageWord } from "@shared/utils/language.contract";
import type { LanguageWordRowViewModel } from "../presentation/languageWordRowViewModel";

defineProps<{
  rows: readonly LanguageWordRowViewModel[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error?: string | null;
  emptyMessage: string;
  deletingId?: string | null;
}>();
defineEmits<{
  open: [word: LanguageWord];
  enroll: [word: LanguageWord];
  delete: [word: LanguageWord];
  "load-more": [];
}>();
</script>

<style scoped>
.word-bank-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.word-bank-list__row {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  overflow: hidden;
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border: 1px solid var(--color-secondary);
  border-radius: var(--component-card-radius);
  background: var(--ds-surface-card);
}
.word-bank-list__row::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  background: var(--word-accent);
  content: "";
}
.word-bank-list__open {
  display: flex;
  min-width: 0;
  flex: 1 1 220px;
  align-items: center;
  gap: var(--space-3);
  text-align: left;
  text-decoration: none;
}
.word-bank-list__main {
  display: flex;
  min-width: 0;
  flex: 1 1 180px;
  flex-direction: column;
}
.word-bank-list__word {
  color: var(--color-content-on-surface-strong);
  font-size: 15px;
  font-weight: 700;
}
.word-bank-list__gloss {
  color: var(--color-content-secondary);
  font-size: 13px;
}
.word-bank-list__actions {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-left: var(--space-1);
}
.word-bank-list__delete {
  min-height: var(--target-compact);
  padding: 0 var(--space-3);
  border-radius: var(--radius-lg);
  background: color-mix(
    in srgb,
    var(--color-error) 10%,
    var(--color-background)
  );
  color: var(--color-error-text);
  font-size: var(--text-xs);
  font-weight: 700;
}
.word-bank-list__delete:disabled {
  opacity: 0.55;
}
</style>
