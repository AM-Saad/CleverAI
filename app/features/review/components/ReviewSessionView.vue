<template>
  <ReviewSessionCard
    :finished="finished"
    :xp="summaryXp"
    :reviewed-count="reviewedCount"
    :total="sessionTotal"
    :minutes="elapsedMinutes"
    :streak="streak"
    :accuracy="accuracy"
    :achievement="achievement"
    :progress-pct="progressPct"
    :loading="loading"
    :error="errorMsg"
    :has-card="Boolean(current)"
    :card-key="current?.cardId"
    :eyebrow="eyebrow"
    :question="qa.question"
    :answer="qa.answer"
    :revealed="revealed"
    :state="current?.reviewState ?? null"
    :disabled="submitting"
    @close="goHome"
    @done="goHome"
    @retry="load"
    @reveal="revealed = true"
    @grade="onGrade"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import ReviewSessionCard from "~/features/review/components/ReviewSessionCard.vue";
import {
  gradeEnumFor,
  type GradeKey,
} from "~/composables/review/useSm2Preview";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";

const props = withDefaults(
  defineProps<{
    workspaceId?: string;
    closeTo?: string;
    limit?: number;
  }>(),
  {
    closeTo: "/",
    limit: 20,
  },
);

const review = useCardReview();
const sessionSummary = useSessionSummary();
const { activeWorkspace } = useActiveWorkspace();
const toast = useToast();

const revealed = ref(false);
const reviewedCount = ref(0);
const correctCount = ref(0);
const sessionTotal = ref(0);
const finished = ref(false);
const startedAt = ref(Date.now());
const streak = ref(0);
const summaryXp = ref(0);
const achievement = ref<string | null>(null);
const mounted = ref(false);
const finishing = ref(false);
let sessionEpoch = 0;

const waitingForPendingGrades = computed(
  () => !review.hasCards.value && review.isGrading.value && !finished.value,
);
const loading = computed(
  () =>
    review.isLoading.value || finishing.value || waitingForPendingGrades.value,
);
const submitting = computed(() => review.isSubmitting.value || finishing.value);
const errorMsg = computed(() => review.error.value);
const current = computed(() => review.currentCard.value);

const progressPct = computed(() =>
  sessionTotal.value === 0
    ? 0
    : Math.round((reviewedCount.value / sessionTotal.value) * 100),
);
const accuracy = computed(() =>
  reviewedCount.value === 0
    ? 0
    : Math.round((correctCount.value / reviewedCount.value) * 100),
);
const elapsedMinutes = computed(() =>
  Math.max(1, Math.round((Date.now() - startedAt.value) / 60000)),
);

const qa = computed(() => extractQA(current.value));
const eyebrow = computed(() => {
  const type = current.value?.resourceType ?? "flashcard";
  const subject = activeWorkspace.value?.title ?? "Review";
  return `${type.toUpperCase()} · ${subject}`;
});

type AnyResource = Record<string, unknown>;
function extractQA(card: typeof current.value): {
  question: string;
  answer: string;
} {
  if (!card) return { question: "", answer: "" };
  const r = card.resource as AnyResource;
  if (typeof r.front === "string")
    return { question: r.front, answer: String(r.back ?? "") };
  if (typeof r.question === "string") {
    const choices = (r.choices as string[]) ?? [];
    const idx = (r.answerIndex as number) ?? 0;
    return { question: r.question, answer: choices[idx] ?? "" };
  }
  return { question: String(r.title ?? ""), answer: String(r.content ?? "") };
}

async function onGrade(key: GradeKey) {
  const card = current.value;
  if (!card || submitting.value) return;
  const epoch = sessionEpoch;

  const wasRevealed = revealed.value;
  const wasLastCard = review.reviewQueue.value.length <= 1;
  revealed.value = false;
  if (key !== "again") correctCount.value += 1;
  reviewedCount.value += 1;
  finishing.value = wasLastCard;
  try {
    const result = await review.grade(card.cardId, gradeEnumFor(key));
    if (epoch !== sessionEpoch) return;
    if (!result) {
      reviewedCount.value = Math.max(0, reviewedCount.value - 1);
      if (key !== "again")
        correctCount.value = Math.max(0, correctCount.value - 1);
      if (current.value?.cardId === card.cardId) revealed.value = wasRevealed;
      toast.add({
        title: "Grade not saved",
        description:
          review.gradeError.value?.message ??
          "That card was returned to the queue.",
        color: "warning",
      });
      return;
    }

    if (!review.hasCards.value && !review.isGrading.value) await endSession();
  } finally {
    if (epoch === sessionEpoch) finishing.value = false;
  }
}

async function endSession() {
  await sessionSummary.endSession();
  summaryXp.value = sessionSummary.summary.value?.xpGained ?? 0;
  if (sessionSummary.summary.value?.leveledUp) {
    achievement.value = `Level ${sessionSummary.summary.value.levelAfter} reached`;
  } else if (sessionSummary.summary.value?.stageUnlocked) {
    achievement.value = `${sessionSummary.summary.value.stageAfter} unlocked`;
  }
  finished.value = true;
}

async function fetchStreak() {
  try {
    const res = await $fetch<{ data?: { currentStreak?: number } }>(
      "/api/review/analytics",
    );
    streak.value = res?.data?.currentStreak ?? 0;
  } catch {
    /* non-blocking */
  }
}

async function load() {
  const epoch = ++sessionEpoch;
  startedAt.value = Date.now();
  reviewedCount.value = 0;
  correctCount.value = 0;
  summaryXp.value = 0;
  achievement.value = null;
  finished.value = false;
  finishing.value = false;
  revealed.value = false;
  await Promise.all([
    sessionSummary.startSession(),
    review.fetchQueue(props.workspaceId, props.limit),
  ]);
  if (epoch !== sessionEpoch) return;
  sessionTotal.value = review.reviewQueue.value.length;
  void fetchStreak();
}

function goHome() {
  navigateTo(props.closeTo);
}

watch(
  () => props.workspaceId,
  () => {
    if (mounted.value) void load();
  },
);

onMounted(() => {
  mounted.value = true;
  void load();
});
</script>
