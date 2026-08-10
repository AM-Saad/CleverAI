<template>
  <div class="learning-home">
    <header class="learning-home__header">
      <!-- <UiLabel size="sm" weight="bold" color="primary" uppercase>
        Learning
      </UiLabel> -->
      <UiTitle tag="h1" size="2xl" weight="bold" color="content-on-background" tight>
        Come back curious!
      </UiTitle>
    </header>

    <UiPanel variant="surface" size="lg" radius="2xl" shadow="sm" :tone="pulseTone" :class-name="['learning-pulse', `learning-pulse--${pulseSource}`].join(' ')
      ">
      <div class="learning-pulse__content">
        <div class="learning-pulse__topline">
          <UiBadge :tone="pulseBadgeTone" variant="soft" icon="home">
            Your Learning Pulse
          </UiBadge>
          <UiParagraph size="xs" color="content-secondary">
            {{ pulseTimeLabel }}
          </UiParagraph>
        </div>

        <div class="learning-pulse__copy" aria-live="polite">
          <UiTitle tag="h2" size="sm" weight="medium" color="content-on-surface-strong">
            {{ pulseTitle }}
          </UiTitle>
          <UiParagraph size="xs" color="content-secondary">
            {{ pulseDescription }}
          </UiParagraph>
        </div>

        <div v-if="showPulseSignals" class="learning-pulse__signals">
          <span v-if="workspaceDue > 0">
            <!-- <UiIcon name="layers" class="h-3.5 w-3.5" /> -->
            {{ workspaceDueLabel }}
          </span>
          <span v-if="languageDue > 0">
            <UiIcon name="languages" class="h-3.5 w-3.5" />
            {{ languageDueLabel }}
          </span>
          <span v-if="tomorrowTotal > 0">
            <UiIcon name="calendar-clock" class="h-3.5 w-3.5" />
            {{ tomorrowDueLabel }}
          </span>
        </div>

        <UiButton v-if="pulseSource === 'error'" size="lg" block tone="neutral" variant="soft" leading-icon="refresh-cw"
          :loading="pulseLoading" @click="refresh">
          Try again
        </UiButton>
        <UiButton v-else :to="pulseActionTo" size="lg" block :tone="pulseSource === 'done' ? 'neutral' : 'primary'"
          :variant="pulseSource === 'done' ? 'soft' : 'solid'" trailing-icon="arrow-right" :loading="pulseLoading"
          :disabled="pulseLoading">
          {{ pulseActionLabel }}
        </UiButton>
      </div>
    </UiPanel>

    <section class="learning-home__section" aria-labelledby="learning-areas-title">
      <!-- <div class="learning-home__section-heading">
        <UiTitle id="learning-areas-title" tag="h2" size="base" weight="bold" color="content-on-surface-strong">
          Your learning world
        </UiTitle>
        <UiParagraph size="xs" color="content-secondary">
          Choose where you want to go.
        </UiParagraph>
      </div> -->

      <div class="learning-home__areas">
        <UiPanel v-for="area in learningAreas" :key="area.key" tag="article" variant="surface" size="sm" radius="xl"
          :class-name="`learning-area learning-area--${area.key}`">
          <span class="learning-area__icon" aria-hidden="true">
            <UiIcon :name="area.icon" class="h-full w-full" />
          </span>
          <div class="learning-area__content">

            <div class="learning-area__copy">
              <UiTitle tag="h3" size="sm" weight="medium" color="content-on-surface-strong">
                {{ area.title }}
              </UiTitle>
              <UiParagraph size="xs" color="content-secondary">
                {{ area.description }}
              </UiParagraph>
            </div>
            <UiButton :to="area.to" size="sm" block tone="neutral" variant="soft" trailing-icon="chevron-right">
              {{ area.action }}
            </UiButton>
          </div>
        </UiPanel>
      </div>
    </section>

    <section class="learning-home__section" aria-labelledby="learning-spark-title">
      <div class="learning-home__section-heading learning-home__section-heading--row">
        <div>
          <UiTitle id="learning-spark-title" tag="h2" size="base" weight="bold" color="content-on-surface-strong">
            Today’s Spark
          </UiTitle>
          <UiParagraph size="xs" color="content-secondary">
            One honest check. Think before reveal.
          </UiParagraph>
        </div>
        <UiBadge v-if="dailySpark" :tone="dailySpark.source === 'language' ? 'info' : 'neutral'" variant="soft">
          {{ dailySpark.sourceLabel }}
        </UiBadge>
      </div>

      <UiPanel v-if="homeLoading" variant="subtle" size="md" radius="xl">
        <div class="learning-spark__skeletons">
          <UiSkeleton class="h-4 w-28 rounded-[var(--radius-sm)]" />
          <UiSkeleton class="h-14 w-full rounded-[var(--radius-md)]" />
          <UiSkeleton class="h-9 w-full rounded-[var(--radius-md)]" />
        </div>
      </UiPanel>

      <UiPanel v-else-if="dailySpark" variant="surface" size="md" radius="xl" class-name="learning-spark">
        <div class="learning-spark__content">

          <UiButton :to="dailySpark.sourceHref" block size="xs" tone="neutral" variant="link" leading-icon="file"
            class="learning-spark__source">
            From {{ dailySpark.sourceDetail }}
          </UiButton>

          <UiParagraph size="base" weight="bold" color="content-on-surface-strong" dir="auto"
            class="learning-spark__question">
            {{ dailySpark.question }}
          </UiParagraph>
          <UiParagraph v-if="dailySpark.supportingText" size="xs" color="content-secondary" dir="auto"
            class="learning-spark__choices">
            {{ dailySpark.supportingText }}
          </UiParagraph>

          <div v-if="!sparkConfidence" class="learning-spark__bet">
            <UiLabel size="sm" weight="medium" color="content-secondary">
              Before revealing, what’s your bet?
            </UiLabel>
            <div class="learning-spark__bet-actions">
              <UiButton v-for="option in confidenceOptions" :key="option.value" size="sm" block tone="neutral"
                variant="soft" @click="chooseConfidence(option.value)">
                {{ option.label }}
              </UiButton>
            </div>
          </div>

          <div v-else class="learning-spark__answer" role="status" aria-live="polite">
            <div class="learning-spark__answer-topline">
              <UiLabel size="sm" weight="bold" color="primary" uppercase>
                Answer
              </UiLabel>
              <UiButton size="xs" tone="neutral" variant="ghost" @click="sparkConfidence = null">
                Bet again
              </UiButton>
            </div>
            <UiParagraph size="sm" color="content-on-surface-strong" dir="auto" class="learning-spark__answer-copy">
              {{ dailySpark.answer }}
            </UiParagraph>
            <UiParagraph size="xs" :color="confidenceFeedback.color">
              {{ confidenceFeedback.text }}
            </UiParagraph>
            <UiButton :to="sparkActionTo" size="sm" block tone="primary" variant="soft" trailing-icon="arrow-right">
              {{ sparkActionLabel }}
            </UiButton>
          </div>
        </div>
      </UiPanel>

      <UiPanel v-else variant="subtle" size="md" radius="xl">
        <div class="learning-spark__empty">
          <span class="learning-spark__mark" aria-hidden="true">
            <UiIcon name="circle-check" class="h-5 w-5" />
          </span>
          <div>
            <UiTitle tag="h3" size="base" weight="bold" color="content-on-surface-strong">
              {{ homeError ? "Spark unavailable" : "Your spark is resting" }}
            </UiTitle>
            <UiParagraph size="xs" color="content-secondary">
              {{
                homeError ??
                "Nothing is due right now. Add something worth remembering."
              }}
            </UiParagraph>
          </div>
        </div>
      </UiPanel>
    </section>

    <section v-if="memoryPostcard" class="learning-home__section" aria-labelledby="learning-postcard-title">
      <div class="learning-home__section-heading">
        <UiTitle id="learning-postcard-title" tag="h2" size="base" weight="bold" color="content-on-surface-strong">
          Back from your past
        </UiTitle>
        <UiParagraph size="xs" color="content-secondary">
          Something you chose to remember, pulled from your history.
        </UiParagraph>
      </div>

      <UiPanel variant="surface" size="md" radius="xl" class-name="learning-postcard">

        <div class="learning-postcard__content">

          <div class="learning-postcard__copy">
            <UiParagraph size="sm" color="content-on-surface-strong" dir="auto">
              {{ memoryPostcard.postcardText }}
            </UiParagraph>
            <UiParagraph size="xs" color="content-secondary">
              {{ postcardMeta }} · {{ memoryPostcard.sourceLabel }}
            </UiParagraph>
            <UiButton :to="memoryPostcard.sourceHref" size="xs" tone="neutral" variant="link" leading-icon="file"
              class="learning-postcard__source">
              From {{ memoryPostcard.sourceDetail }}
            </UiButton>
          </div>
          <UiButton :to="memoryPostcard.sourceHref" size="sm" tone="neutral" variant="ghost"
            trailing-icon="arrow-right">
            Open source
          </UiButton>
        </div>
      </UiPanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useLearningHomeExperience } from "~/features/learning-shell/composables/useLearningHomeExperience";

type Confidence = "know" | "unsure" | "forgot";
type PulseSource = "workspace" | "language" | "done" | "empty" | "error";

const {
  snapshot,
  dailySpark,
  memoryPostcard,
  isLoading: homeLoading,
  error: homeError,
  refresh,
} = useLearningHomeExperience();

const sparkConfidence = ref<Confidence | null>(null);
const workspaceDue = computed(() =>
  (snapshot.value?.workspaceStatuses ?? []).reduce(
    (total, workspace) => total + workspace.due,
    0,
  ),
);
const languageDue = computed(() => snapshot.value?.languageStatus.due ?? 0);
const tomorrowTotal = computed(() => snapshot.value?.tomorrow.total ?? 0);
const workspaceCount = computed(
  () => snapshot.value?.workspaceStatuses.length ?? 0,
);
const pulseLoading = computed(() => homeLoading.value && !snapshot.value);
const nextAction = computed(() => snapshot.value?.nextAction ?? null);
const pulseSource = computed<PulseSource>(() => {
  if (homeError.value && !snapshot.value) return "error";
  return snapshot.value?.nextAction.kind ?? "empty";
});
const pulseTitle = computed(() => {
  if (pulseLoading.value) return "Reading your learning rhythm";
  if (pulseSource.value === "error") return "Pulse couldn't be loaded";
  if (pulseSource.value === "workspace") {
    const action = nextAction.value;
    return `${action?.kind === "workspace" ? action.workspaceTitle : "Workspace"} comes first`;
  }
  if (pulseSource.value === "language") return "Language comes first";
  if (pulseSource.value === "done") return "Everything due is handled";
  return "Build something worth remembering";
});
const pulseDescription = computed(() => {
  if (pulseLoading.value) return "Finding your most useful next move.";
  if (pulseSource.value === "error") {
    return homeError.value ?? "Check your connection and try again.";
  }
  const action = nextAction.value;
  if (action?.kind === "workspace") {
    return `${action.dueCount} ${action.dueCount === 1 ? "item is" : "items are"} ready in ${action.workspaceTitle}. ${oldestDueSentence(action.oldestDueAt)}${otherDueSentence(action.otherDueCount)}`;
  }
  if (action?.kind === "language") {
    return `${action.dueCount} ${action.dueCount === 1 ? "word is" : "words are"} ready. ${oldestDueSentence(action.oldestDueAt)}${otherDueSentence(action.otherDueCount)}`;
  }
  if (pulseSource.value === "done") {
    return tomorrowTotal.value
      ? `No review needs attention now. ${tomorrowTotal.value} ${tomorrowTotal.value === 1 ? "item returns" : "items return"} tomorrow.`
      : "No scheduled review needs attention. Explore something new or return later.";
  }
  return "Create a workspace or capture a useful word. Clever will bring it back when it matters.";
});
const pulseActionTo = computed(() => nextAction.value?.to ?? "/workspaces");
const pulseActionLabel = computed(() => {
  if (pulseLoading.value) return "Finding next move";
  const action = nextAction.value;
  if (action?.kind === "workspace") {
    return `Review ${action.dueCount} ${action.dueCount === 1 ? "item" : "items"}`;
  }
  if (action?.kind === "language") {
    return `Review ${action.dueCount} ${action.dueCount === 1 ? "word" : "words"}`;
  }
  if (pulseSource.value === "done") return "Explore something new";
  return "Create first workspace";
});
const pulseTone = computed(() => {
  if (pulseSource.value === "error") return "error" as const;
  if (pulseSource.value === "done") return "success" as const;
  if (pulseSource.value === "workspace" || pulseSource.value === "language") {
    return "info" as const;
  }
  return "neutral" as const;
});
const pulseBadgeTone = computed(() => {
  if (pulseSource.value === "error") return "error" as const;
  if (pulseSource.value === "done") return "success" as const;
  return "info" as const;
});
const pulseTimeLabel = computed(() => {
  if (pulseLoading.value) return "Updating";
  if (pulseSource.value === "error") return "Unavailable";
  if (pulseSource.value === "done") return "Caught up";
  if (pulseSource.value === "empty") return "Ready when you are";
  const action = nextAction.value;
  if (action?.kind === "workspace" || action?.kind === "language") {
    return oldestDueLabel(action.oldestDueAt);
  }
  return "Updated now";
});
const showPulseSignals = computed(
  () =>
    !pulseLoading.value &&
    (workspaceDue.value > 0 ||
      languageDue.value > 0 ||
      tomorrowTotal.value > 0),
);
const workspaceDueLabel = computed(
  () =>
    `${workspaceDue.value} workspace ${workspaceDue.value === 1 ? "item" : "items"}`,
);
const languageDueLabel = computed(
  () =>
    `${languageDue.value} language ${languageDue.value === 1 ? "word" : "words"}`,
);
const tomorrowDueLabel = computed(
  () =>
    `${tomorrowTotal.value} ${tomorrowTotal.value === 1 ? "item returns" : "items return"} tomorrow`,
);

const learningAreas = computed(() => [
  {
    key: "workspaces",
    title: "Workspaces",
    description: workspaceDue.value
      ? `${workspaceDue.value} ready across ${workspaceCount.value} ${workspaceCount.value === 1 ? "workspace" : "workspaces"}`
      : workspaceCount.value
        ? `${workspaceCount.value} ${workspaceCount.value === 1 ? "workspace" : "workspaces"} · up to date`
        : "Materials, flashcards, quizzes",
    action: "Choose",
    to: "/workspaces",
    icon: "layers",
  },
  {
    key: "languages",
    title: "Languages",
    description: languageDue.value
      ? `${languageDue.value} ${languageDue.value === 1 ? "word" : "words"} ready`
      : "Words, stories, review",
    action: "Open",
    to: "/language",
    icon: "languages",
  },
]);

function overdueDays(value: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
  );
}

function oldestDueSentence(value: string) {
  const days = overdueDays(value);
  if (days === 0) return "Oldest became due today.";
  return `Oldest has waited ${days} ${days === 1 ? "day" : "days"}.`;
}

function oldestDueLabel(value: string) {
  const days = overdueDays(value);
  if (days === 0) return "Oldest due today";
  return `Oldest ${days}d overdue`;
}

function otherDueSentence(count: number) {
  if (!count) return "";
  return ` ${count} more ${count === 1 ? "item waits" : "items wait"} elsewhere.`;
}

const confidenceOptions: ReadonlyArray<{
  value: Confidence;
  label: string;
}> = [
    { value: "know", label: "I know it" },
    { value: "unsure", label: "Unsure" },
    { value: "forgot", label: "Forgot" },
  ];
const confidenceFeedback = computed(() => {
  if (sparkConfidence.value === "know") {
    return {
      text: "Good instinct. Confirm it in review to update its schedule.",
      color: "success" as const,
    };
  }
  if (sparkConfidence.value === "forgot") {
    return {
      text: "Perfect catch. This is why Clever brought it back.",
      color: "content-secondary" as const,
    };
  }
  return {
    text: "Worth one quick review while the answer is fresh.",
    color: "content-secondary" as const,
  };
});
const sparkIsDue = computed(() => {
  const spark = dailySpark.value;
  const generatedAt = snapshot.value?.generatedAt;
  if (!spark || !generatedAt) return false;
  return (
    new Date(spark.nextReviewAt).getTime() <= new Date(generatedAt).getTime()
  );
});
const sparkActionTo = computed(() => {
  const spark = dailySpark.value;
  if (!spark) return "/learn";
  return sparkIsDue.value ? spark.to : spark.sourceHref;
});
const sparkActionLabel = computed(() =>
  sparkIsDue.value ? "Practice this queue" : "Open source",
);
const postcardMeta = computed(() => {
  const postcard = memoryPostcard.value;
  if (!postcard) return "Back for another look";
  if (postcard.lastReviewedAt) {
    const elapsed = Date.now() - new Date(postcard.lastReviewedAt).getTime();
    const days = Math.max(1, Math.floor(elapsed / 86_400_000));
    return `Last practiced ${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (postcard.intervalDays > 0) {
    return `Returning after ${postcard.intervalDays} ${postcard.intervalDays === 1 ? "day" : "days"}`;
  }
  return "Back for another look";
});

function chooseConfidence(value: Confidence) {
  sparkConfidence.value = value;
}

watch(
  () => dailySpark.value?.id,
  () => {
    sparkConfidence.value = null;
  },
);
</script>

<style scoped>
.learning-home {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding-top: var(--space-2);
  padding-bottom: var(--space-6);
}

.learning-home__header,
.learning-home__section,
.learning-home__section-heading,
.learning-area__content,
.learning-area__copy,
.learning-pulse__content,
.learning-pulse__copy,
.learning-spark__content,
.learning-spark__bet,
.learning-spark__answer,
.learning-spark__skeletons {
  display: flex;
  flex-direction: column;


}

.learning-home__header {
  gap: var(--space-1);
}

.learning-home__section {
  gap: var(--space-3);
}

.learning-home__section-heading {
  gap: 2px;
}

.learning-home__section-heading--row,
.learning-pulse__topline,
.learning-spark__answer-topline,
.learning-postcard__content,
.learning-spark__empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.learning-home__section-heading--row {
  align-items: start;
}

.learning-home__section-heading--row>div {
  min-width: 0;
}

.learning-pulse {
  --pulse-accent: var(--color-accent-indigo);
  position: relative;
  isolation: isolate;
  border: 0;
  border-color: color-mix(in srgb,
      var(--pulse-accent) 24%,
      var(--color-secondary));
  background:
    radial-gradient(circle at 92% 8%,
      color-mix(in srgb, var(--pulse-accent) 18%, transparent),
      transparent 38%),
    var(--color-surface);
}

.learning-pulse--language {
  --pulse-accent: var(--color-accent-purple);
}

.learning-pulse--done {
  --pulse-accent: var(--color-success);
}

.learning-pulse--error {
  --pulse-accent: var(--color-error);
}

.learning-pulse__content {
  position: relative;
  z-index: 1;
  gap: var(--space-4);
}

.learning-pulse__copy {
  gap: var(--space-1);
  max-width: 34rem;
}

.learning-pulse__signals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.learning-pulse__signals span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
}

.learning-home__areas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.learning-area {
  --area-accent: var(--color-accent-indigo);
  /* border-color: color-mix(in srgb,
      var(--area-accent) 10%,
      var(--color-secondary)); */
  border: 0;
  position: relative;
  z-index: 2;
}

.learning-area--languages {
  --area-accent: var(--color-accent-purple);
}

.learning-area__content {
  gap: var(--space-3);
}

.learning-area__icon {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border-radius: var(--radius-xl);
  position: absolute;
  top: -30px;
  right: -70px;
  z-index: -1;
  opacity: .03
}

.learning-area__icon {
  /* background: color-mix(in srgb, var(--area-accent) 14%, transparent); */
  color: var(--area-accent);
  height: 100%;
  width: 100%
}

.learning-area__copy {
  flex: 1;
  gap: 2px;
}

.learning-spark {
  border-color: color-mix(in srgb,
      var(--color-accent-orange) 24%,
      var(--color-secondary));
}

.learning-spark__content {
  gap: var(--space-3);
}

.learning-spark__mark {
  /* background: color-mix(in srgb, var(--color-accent-orange) 14%, transparent); */
  color: var(--color-accent-orange);
}

.learning-spark__question {
  max-width: 38rem;
}

.learning-spark__source,
.learning-postcard__source {
  /* align-self: flex-start; */
  /* max-width: 100%; */

}

.learning-spark__choices,
.learning-spark__answer-copy {
  white-space: pre-line;
}

.learning-spark__bet,
.learning-spark__answer,
.learning-spark__skeletons {
  gap: var(--space-2);
}

.learning-spark__bet-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.learning-spark__answer {
  padding: var(--space-3);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  animation: learning-answer-in 180ms ease-out;
}

.learning-spark__empty {
  justify-content: flex-start;
}

.learning-postcard {
  border-style: dashed;
  border-color: color-mix(in srgb,
      var(--color-accent-teal) 30%,
      var(--color-secondary));
  position: relative;
}

.learning-postcard__content {
  justify-content: flex-start;
  align-items: start
}

.learning-postcard__copy {
  min-width: 0;
  flex: 1;
}

@keyframes learning-answer-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 420px) {
  /* .learning-home__areas {
    grid-template-columns: 1fr;
  } */

  .learning-home__section-heading--row,
  .learning-postcard__content {
    align-items: flex-start;
    flex-wrap: wrap;
    flex-direction: column;
  }

  .learning-postcard__content> :last-child {
    margin-left: 52px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .learning-spark__answer {
    animation: none;
  }
}
</style>
