<template>
  <section class="study-content" aria-labelledby="study-content-title">
    <div class="study-content__heading">
      <div>
        <UiTitle id="study-content-title" tag="h2" size="lg" weight="bold" color="content-on-surface-strong" tight>
          Study content
        </UiTitle>
        <UiParagraph size="xs" color="content-secondary">
          Practice what was generated from this material.
        </UiParagraph>
      </div>
      <UiBadge tone="neutral" variant="soft">
        {{ flashcards.length + questions.length }} items
      </UiBadge>
    </div>

    <UiSegmentedControl :model-value="mode" label="Study content type" :items="contentTypes"
      @update:model-value="selectMode" />

    <div v-if="mode === 'flashcards'" class="study-content__viewer">
      <CardStack :items="flashcards" class="study-content__stack">
        <template #default="{ item: card }">
          <FlipCard min-height="100%">
            <template #front>
              <span class="study-content__eyebrow">Flashcard</span>
              <UiParagraph tag="span" class-name="study-content__card-copy" size="base" weight="bold"
                color="content-on-surface-strong" dir="auto">
                {{ card.front }}
              </UiParagraph>
              <span class="study-content__flip-hint">
                <UiIcon name="refresh-cw" class="h-4 w-4" aria-hidden="true" />
                Tap to reveal
              </span>
            </template>

            <template #back>
              <span class="study-content__eyebrow study-content__eyebrow--answer">
                Answer
              </span>
              <UiParagraph tag="span" class-name="study-content__card-copy" size="sm" weight="semibold"
                color="content-on-surface-strong" dir="auto">
                {{ card.back }}
              </UiParagraph>
              <span class="study-content__flip-hint">
                <UiIcon name="refresh-cw" class="h-4 w-4" aria-hidden="true" />
                Tap to flip
              </span>
            </template>
          </FlipCard>
        </template>
      </CardStack>
    </div>

    <div v-else-if="currentQuestion" class="study-content__viewer">
      <Transition name="study-card-swap" mode="out-in">
        <UiPanel :key="currentQuestion.id" variant="surface" size="md">
          <div class="study-content__quiz">
            <span class="study-content__eyebrow">
              Question {{ questionIndex + 1 }} of {{ questions.length }}
            </span>
            <UiParagraph size="lg" weight="bold" color="content-on-surface-strong" dir="auto">
              {{ currentQuestion.question }}
            </UiParagraph>

            <ul class="study-content__choices">
              <li v-for="(choice, choiceIndex) in currentQuestion.choices" :key="choiceIndex">
                <UiListCard clickable selectable size="sm" :selected="selectedChoice === choiceIndex" :title="choice"
                  :aria-label="`Answer ${choiceLetter(choiceIndex)}: ${choice}`" @click="chooseAnswer(choiceIndex)">
                  <template #leading>
                    <span aria-hidden="true">{{
                      choiceLetter(choiceIndex)
                      }}</span>
                  </template>
                  <template v-if="selectedChoice !== null" #action>
                    <UiIcon v-if="choiceIndex === currentQuestion.answerIndex" name="circle-check"
                      class="h-5 w-5 text-success-text" aria-label="Correct answer" />
                    <UiIcon v-else-if="choiceIndex === selectedChoice" name="circle-x" class="h-5 w-5 text-error-text"
                      aria-label="Incorrect answer" />
                  </template>
                </UiListCard>
              </li>
            </ul>

            <UiAlert v-if="selectedChoice !== null" :tone="answerIsCorrect ? 'success' : 'error'" :icon="answerIsCorrect ? 'circle-check' : 'circle-x'
              " :title="answerIsCorrect ? 'Correct' : 'Not quite'" :description="answerFeedback" />
          </div>
        </UiPanel>
      </Transition>

      <div class="study-content__pager" aria-label="Quiz navigation">
        <UiIconButton icon="chevron-left" label="Previous question" variant="soft" :disabled="questionIndex === 0"
          @click="questionIndex -= 1" />
        <UiParagraph size="sm" weight="semibold" color="content-secondary">
          {{ questionIndex + 1 }} / {{ questions.length }}
        </UiParagraph>
        <UiIconButton icon="chevron-right" label="Next question" variant="soft"
          :disabled="questionIndex === questions.length - 1" @click="questionIndex += 1" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CardStack from "~/components/ui/CardStack.vue";
import FlipCard from "~/components/ui/flip-card/FlipCard.vue";
import type {
  MaterialGeneratedFlashcard,
  MaterialGeneratedQuestion,
} from "~/shared/utils/material.contract";

const props = defineProps<{
  flashcards: MaterialGeneratedFlashcard[];
  questions: MaterialGeneratedQuestion[];
}>();

type ContentMode = "flashcards" | "quiz";

const mode = ref<ContentMode>(
  props.flashcards.length > 0 ? "flashcards" : "quiz",
);
const questionIndex = ref(0);
const selectedChoice = ref<number | null>(null);

const contentTypes = computed(() => [
  {
    value: "flashcards",
    label: "Flashcards",
    icon: "copy",
    count: props.flashcards.length,
    disabled: props.flashcards.length === 0,
  },
  {
    value: "quiz",
    label: "Quiz",
    icon: "list-checks",
    count: props.questions.length,
    disabled: props.questions.length === 0,
  },
]);
const currentQuestion = computed(
  () => props.questions[questionIndex.value] ?? null,
);
const answerIsCorrect = computed(
  () =>
    selectedChoice.value !== null &&
    selectedChoice.value === currentQuestion.value?.answerIndex,
);
const answerFeedback = computed(() => {
  if (answerIsCorrect.value) return "Nice work.";
  const question = currentQuestion.value;
  if (!question) return "";
  return `Correct answer: ${question.choices[question.answerIndex] ?? "Answer unavailable"
    }`;
});

watch(
  () => [props.flashcards.length, props.questions.length] as const,
  ([flashcardCount, questionCount]) => {
    questionIndex.value = Math.min(
      questionIndex.value,
      Math.max(0, questionCount - 1),
    );
    if (
      mode.value === "flashcards" &&
      flashcardCount === 0 &&
      questionCount > 0
    )
      mode.value = "quiz";
    if (mode.value === "quiz" && questionCount === 0 && flashcardCount > 0)
      mode.value = "flashcards";
  },
);
watch([mode, questionIndex], () => {
  selectedChoice.value = null;
});

function selectMode(value: string) {
  if (value !== "flashcards" && value !== "quiz") return;
  mode.value = value;
}

function chooseAnswer(index: number) {
  if (selectedChoice.value !== null) return;
  selectedChoice.value = index;
}

function choiceLetter(index: number) {
  return String.fromCharCode(65 + index);
}
</script>

<style scoped>
.study-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.study-content__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.study-content__viewer,
.study-content__quiz {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.study-content__stack {
  height: 300px;
}

.study-content__eyebrow {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.study-content__eyebrow--answer {
  color: var(--color-primary);
}

.study-content__card-copy {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  text-align: center;
  white-space: pre-line;
}

.study-content__flip-hint {
  display: inline-flex;
  align-self: center;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
}

.study-content__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}

.study-content__choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0;
  margin: 0;
  list-style: none;
}

.study-card-swap-enter-active,
.study-card-swap-leave-active {
  transition:
    transform var(--duration-normal) var(--ease-emphasized),
    opacity var(--duration-fast) var(--ease-standard);
}

.study-card-swap-enter-from {
  opacity: 0;
  transform: translateX(18px) scale(0.99);
}

.study-card-swap-leave-to {
  opacity: 0;
  transform: translateX(-18px) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {

  .study-card-swap-enter-active,
  .study-card-swap-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
