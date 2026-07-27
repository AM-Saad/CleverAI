<template>
  <article
    class="action-row"
    :class="{ 'action-row--completed': item.completed }"
  >
    <div class="action-row_content">
      <UiCheckbox
        :model-value="item.completed"
        :aria-label="`Mark ${item.title} complete`"
        @update:model-value="$emit('toggle', Boolean($event))"
      />
      <UiButton
        type="button"
        tone="neutral"
        variant="link"
        class="action-row__main"
        :aria-label="
          conflicted
            ? `${item.title} has a sync conflict`
            : `Edit ${item.title}`
        "
        :disabled="conflicted"
        @click="$emit('edit')"
      >
        <div ref="titleViewport" class="action-row__title" :title="item.title">
          <UiParagraph
            tag="p"
            size="base"
            :color="item.completed ? 'disabled' : 'content-on-surface'"
            class="leading-none"
            :class="{ 'line-through': item.completed }"
          >
            <span
              class="action-row__title-track"
              :class="{
                'action-row__title-track--scrolling': isTitleOverflowing,
              }"
              aria-hidden="true"
            >
              <span class="action-row__title-copy">
                <span ref="titleText">{{ item.title }}</span>
              </span>
              <span v-if="isTitleOverflowing" class="action-row__title-copy">{{
                item.title
              }}</span>
            </span>
          </UiParagraph>
        </div>
        <div class="action-row__meta">
          <UiPill
            v-if="item.timingLabel"
            size="sm"
            :label="item.timingLabel"
            :color="
              item.overdue
                ? 'var(--color-error)'
                : 'var(--color-content-secondary)'
            "
            variant="soft"
          />
          <span v-if="item.recurrenceLabel" class="action-row__repeat">
            <UiIcon name="i-lucide-repeat-2" class="h-3.5 w-3.5" />
            {{ item.recurrenceLabel }}
          </span>
          <span v-if="item.overdue" class="action-row__overdue">Overdue</span>
        </div>
      </UiButton>
    </div>

    <div class="action-row__actions">
      <UiIconButton
        icon="i-lucide-pencil"
        label="Edit action item"
        size="sm"
        :disabled="conflicted"
        @click="$emit('edit')"
      />
      <UiIconButton
        icon="i-lucide-calendar-clock"
        label="Move action item"
        size="sm"
        @click="$emit('move')"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";

const props = defineProps<{
  item: DailyActionViewModel;
  conflicted?: boolean;
}>();
defineEmits<{ toggle: [completed: boolean]; edit: []; move: [] }>();

const titleViewport = ref<HTMLElement | null>(null);
const titleText = ref<HTMLElement | null>(null);
const isTitleOverflowing = ref(false);
let titleResizeObserver: ResizeObserver | undefined;

function updateTitleOverflow() {
  if (!titleViewport.value || !titleText.value) return;
  isTitleOverflowing.value =
    titleText.value.getBoundingClientRect().width >
    titleViewport.value.getBoundingClientRect().width;
}

watch(
  () => props.item.title,
  () => nextTick(updateTitleOverflow),
);

onMounted(() => {
  nextTick(updateTitleOverflow);
  titleResizeObserver = new ResizeObserver(updateTitleOverflow);
  if (titleViewport.value) titleResizeObserver.observe(titleViewport.value);
});

onBeforeUnmount(() => titleResizeObserver?.disconnect());
</script>

<style scoped>
.action-row,
.action-row__meta,
.action-row_content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.action-row {
  gap: var(--space-3);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-secondary);
  justify-content: space-between;
}

.action-row:last-child {
  border-bottom: 0;
}

.action-row__main {
  display: block;
  min-width: 0;
  flex: 1;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none !important;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
}

.action-row__main:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 2px;
}

.action-row__title {
  width: 20rem;
  max-width: 100%;
  overflow: hidden;
  text-align: left;
}

.action-row__title-track,
.action-row__title-copy {
  white-space: nowrap;
}

.action-row__title-track {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-row__title-track--scrolling {
  display: flex;
  width: max-content;
  overflow: visible;
  text-overflow: clip;
}

.action-row__title-track--scrolling .action-row__title-copy {
  flex: none;
  padding-inline-end: var(--space-6);
}

.action-row__title:hover .action-row__title-track--scrolling,
.action-row__main:focus-visible .action-row__title-track--scrolling {
  animation: action-title-scroll 10s linear infinite;
  animation-delay: 1s;
}

@keyframes action-title-scroll {
  to {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-row__title-track--scrolling {
    display: block;
    width: auto;
    overflow: hidden;
    animation: none;
    text-overflow: ellipsis;
  }

  .action-row__title-track--scrolling .action-row__title-copy {
    overflow: hidden;
    padding-inline-end: 0;
    text-overflow: ellipsis;
  }

  .action-row__title-copy + .action-row__title-copy {
    display: none;
  }
}

.action-row__meta {
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.action-row__repeat {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.action-row__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.action-row__overdue {
  color: var(--color-error);
  /* font-weight: 700; */
}
</style>
