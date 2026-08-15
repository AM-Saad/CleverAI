import type { PrismaClient } from "@prisma/client";
import { buildLanguageReviewPresentation } from "../../../../shared/utils/language-review-card";
import {
  LearningHomeSnapshotSchema,
  type LearningHomeLanguageStatus,
  type LearningHomeNextAction,
  type LearningHomePrompt,
  type LearningHomeSnapshot,
  type LearningHomeTomorrow,
  type LearningHomeWorkspaceStatus,
} from "../../../../shared/utils/learning-home.contract";

type WorkspaceCandidate = {
  key: string;
  source: "workspace";
  reviewId: string;
  resourceId: string;
  resourceType: string;
  workspaceId: string;
  workspaceTitle: string;
  repetitions: number;
  intervalDays: number;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
};

type LanguageCandidate = {
  key: string;
  source: "language";
  reviewId: string;
  wordId: string;
  storyId: string | null;
  repetitions: number;
  intervalDays: number;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
};

type LearningCandidate = WorkspaceCandidate | LanguageCandidate;

function truncate(value: string, limit: number) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}…` : clean;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString();
}

function localDayKey(now: Date, timezoneOffsetMinutes: number) {
  return new Date(now.getTime() - timezoneOffsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function tomorrowWindow(
  now: Date,
  timezoneOffsetMinutes: number,
): { start: Date; end: Date; date: string } {
  const shifted = new Date(now.getTime() - timezoneOffsetMinutes * 60_000);
  const tomorrowLocalStart = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1,
  );
  const tomorrowStart = new Date(
    tomorrowLocalStart + timezoneOffsetMinutes * 60_000,
  );
  return {
    start: tomorrowStart,
    end: new Date(tomorrowStart.getTime() + 86_400_000 - 1),
    date: new Date(tomorrowLocalStart).toISOString().slice(0, 10),
  };
}

function sourceAnchor(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const anchor = (value as Record<string, unknown>).anchor;
  return typeof anchor === "string" && anchor.trim()
    ? truncate(anchor, 80)
    : null;
}

function orderedDailyCandidates(candidates: LearningCandidate[], seed: string) {
  if (!candidates.length) return [];
  const sorted = [...candidates].sort(
    (a, b) =>
      a.nextReviewAt.getTime() - b.nextReviewAt.getTime() ||
      a.key.localeCompare(b.key),
  );
  const start = stableHash(seed) % sorted.length;
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

async function workspacePrompt(
  prisma: PrismaClient,
  candidate: WorkspaceCandidate,
): Promise<LearningHomePrompt | null> {
  const base = {
    id: candidate.key,
    source: "workspace" as const,
    sourceLabel: candidate.workspaceTitle,
    to: `/review?workspaceId=${encodeURIComponent(candidate.workspaceId)}`,
    repetitions: candidate.repetitions,
    intervalDays: candidate.intervalDays,
    nextReviewAt: candidate.nextReviewAt.toISOString(),
    lastReviewedAt: iso(candidate.lastReviewedAt),
  };
  const resourceType = candidate.resourceType.toLowerCase();

  if (resourceType === "material") {
    const material = await prisma.material.findFirst({
      where: { id: candidate.resourceId, workspaceId: candidate.workspaceId },
      select: { id: true, title: true, content: true, createdAt: true },
    });
    if (!material) return null;
    return {
      ...base,
      sourceDetail: material.title,
      sourceHref: `/materials/${material.id}`,
      question: material.title,
      answer: truncate(material.content, 420),
      postcardText: truncate(material.content, 260),
      firstLearnedAt: material.createdAt.toISOString(),
    };
  }

  if (resourceType === "question") {
    const question = await prisma.question.findFirst({
      where: { id: candidate.resourceId, workspaceId: candidate.workspaceId },
      select: {
        question: true,
        choices: true,
        answerIndex: true,
        sourceRef: true,
        createdAt: true,
        material: { select: { id: true, title: true } },
      },
    });
    if (!question) return null;
    const answer = question.choices[question.answerIndex] ?? "";
    const anchor = sourceAnchor(question.sourceRef);
    const sourceDetail = question.material?.title ?? "Generated quiz question";
    return {
      ...base,
      sourceDetail: anchor ? `${sourceDetail} · ${anchor}` : sourceDetail,
      sourceHref: question.material
        ? `/materials/${question.material.id}`
        : `/workspaces/${candidate.workspaceId}`,
      question: question.question,
      supportingText: question.choices
        .map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`)
        .join("\n"),
      answer,
      postcardText: `${truncate(question.question, 130)} Answer: ${truncate(answer, 180)}`,
      firstLearnedAt: question.createdAt.toISOString(),
    };
  }

  const flashcard = await prisma.flashcard.findFirst({
    where: { id: candidate.resourceId, workspaceId: candidate.workspaceId },
    select: {
      front: true,
      back: true,
      sourceRef: true,
      createdAt: true,
      material: { select: { id: true, title: true } },
    },
  });
  if (!flashcard) return null;
  const anchor = sourceAnchor(flashcard.sourceRef);
  const sourceDetail = flashcard.material?.title ?? "Generated flashcard";
  return {
    ...base,
    sourceDetail: anchor ? `${sourceDetail} · ${anchor}` : sourceDetail,
    sourceHref: flashcard.material
      ? `/materials/${flashcard.material.id}`
      : `/workspaces/${candidate.workspaceId}`,
    question: flashcard.front,
    answer: flashcard.back,
    postcardText: `${truncate(flashcard.front, 110)} — ${truncate(flashcard.back, 220)}`,
    firstLearnedAt: flashcard.createdAt.toISOString(),
  };
}

async function languagePrompt(
  prisma: PrismaClient,
  candidate: LanguageCandidate,
  userId: string,
): Promise<LearningHomePrompt | null> {
  const review = await prisma.languageCardReview.findFirst({
    where: { id: candidate.reviewId, userId },
    select: {
      mode: true,
      word: {
        select: {
          id: true,
          word: true,
          translation: true,
          sourceLang: true,
          translationLang: true,
          partOfSpeech: true,
          phonetic: true,
          meanings: true,
          examples: true,
          sourceContext: true,
          sourceType: true,
          sourceRefId: true,
          createdAt: true,
        },
      },
      story: { select: { storyText: true, sentences: true } },
    },
  });
  if (!review) return null;

  const word = review.word;
  const reviewCard = buildLanguageReviewPresentation({
    word,
    story: review.story,
    preferredMode: review.mode,
  });
  if (!reviewCard) return null;
  const presentation = reviewCard.presentation;
  const question = presentation.promptContext
    ? `${presentation.question}\nContext: ${presentation.promptContext}`
    : presentation.question;
  const answer = [
    presentation.answer,
    presentation.translation,
    presentation.definition,
    presentation.context?.text,
    presentation.context?.translation,
  ]
    .filter((value, index, all): value is string =>
      Boolean(value && all.indexOf(value) === index),
    )
    .join("\n");
  let sourceDetail =
    reviewCard.mode === "story_cloze"
      ? `Story for “${word.word}”`
      : "Word bank";
  let sourceHref = "/language";

  if (word.sourceType === "material" && word.sourceRefId) {
    const material = await prisma.material.findFirst({
      where: {
        id: word.sourceRefId,
        workspace: { is: { userId } },
      },
      select: { id: true, title: true },
    });
    if (material) {
      sourceDetail = material.title;
      sourceHref = `/materials/${material.id}`;
    }
  }

  return {
    id: candidate.key,
    source: "language",
    sourceLabel:
      reviewCard.mode === "word_definition"
        ? `${word.sourceLang.toUpperCase()} definition`
        : `${word.sourceLang.toUpperCase()} → ${word.translationLang.toUpperCase()}`,
    sourceDetail,
    sourceHref,
    question,
    answer,
    postcardText: `${truncate(question, 110)} — ${truncate(
      presentation.answer,
      220,
    )}`,
    to: "/language/review",
    repetitions: candidate.repetitions,
    intervalDays: candidate.intervalDays,
    nextReviewAt: candidate.nextReviewAt.toISOString(),
    lastReviewedAt: iso(candidate.lastReviewedAt),
    firstLearnedAt: word.createdAt.toISOString(),
  };
}

async function hydratePrompt(
  prisma: PrismaClient,
  candidate: LearningCandidate,
  userId: string,
) {
  return candidate.source === "workspace"
    ? workspacePrompt(prisma, candidate)
    : languagePrompt(prisma, candidate, userId);
}

async function hydrateFirst(
  prisma: PrismaClient,
  candidates: LearningCandidate[],
  userId: string,
) {
  for (const candidate of candidates.slice(0, 8)) {
    const prompt = await hydratePrompt(prisma, candidate, userId);
    if (prompt) return { candidate, prompt };
  }
  return null;
}

export async function buildLearningHomeSnapshot(input: {
  prisma: PrismaClient;
  userId: string;
  timezoneOffsetMinutes: number;
  now?: Date;
}): Promise<LearningHomeSnapshot> {
  const { prisma, userId, timezoneOffsetMinutes } = input;
  const now = input.now ?? new Date();

  const [
    workspaces,
    workspaceReviews,
    languageReviews,
    totalLanguageWords,
    masteredLanguageWords,
  ] = await Promise.all([
    prisma.workspace.findMany({
      where: { userId },
      select: { id: true, title: true },
      orderBy: { order: "asc" },
    }),
    prisma.cardReview.findMany({
      where: { userId, suspended: false },
      select: {
        id: true,
        cardId: true,
        resourceType: true,
        workspaceId: true,
        repetitions: true,
        intervalDays: true,
        nextReviewAt: true,
        lastReviewedAt: true,
      },
    }),
    prisma.languageCardReview.findMany({
      where: { userId, suspended: false },
      select: {
        id: true,
        wordId: true,
        storyId: true,
        repetitions: true,
        intervalDays: true,
        nextReviewAt: true,
        lastReviewedAt: true,
      },
    }),
    prisma.languageWord.count({ where: { userId } }),
    prisma.languageWord.count({ where: { userId, status: "mastered" } }),
  ]);

  const workspaceById = new Map(
    workspaces.map((workspace) => [workspace.id, workspace]),
  );
  const workspaceStatusById = new Map<string, LearningHomeWorkspaceStatus>();
  for (const workspace of workspaces) {
    workspaceStatusById.set(workspace.id, {
      id: workspace.id,
      title: workspace.title,
      total: 0,
      new: 0,
      learning: 0,
      due: 0,
      mature: 0,
      oldestDueAt: null,
      lastReviewedAt: null,
    });
  }

  const candidates: LearningCandidate[] = [];
  for (const review of workspaceReviews) {
    const workspace = workspaceById.get(review.workspaceId);
    const status = workspaceStatusById.get(review.workspaceId);
    if (!workspace || !status) continue;
    status.total += 1;
    if (review.repetitions === 0) status.new += 1;
    else if (review.repetitions < 3) status.learning += 1;
    else status.mature += 1;
    if (review.nextReviewAt.getTime() <= now.getTime()) {
      status.due += 1;
      const dueIso = review.nextReviewAt.toISOString();
      if (!status.oldestDueAt || dueIso < status.oldestDueAt) {
        status.oldestDueAt = dueIso;
      }
    }
    if (review.lastReviewedAt) {
      const reviewedIso = review.lastReviewedAt.toISOString();
      if (!status.lastReviewedAt || reviewedIso > status.lastReviewedAt) {
        status.lastReviewedAt = reviewedIso;
      }
    }
    candidates.push({
      key: `workspace:${review.id}`,
      source: "workspace",
      reviewId: review.id,
      resourceId: review.cardId,
      resourceType: review.resourceType,
      workspaceId: review.workspaceId,
      workspaceTitle: workspace.title,
      repetitions: review.repetitions,
      intervalDays: review.intervalDays,
      nextReviewAt: review.nextReviewAt,
      lastReviewedAt: review.lastReviewedAt,
    });
  }

  const languageStatus: LearningHomeLanguageStatus = {
    totalWords: totalLanguageWords,
    enrolled: languageReviews.length,
    mastered: masteredLanguageWords,
    due: 0,
    new: 0,
    learning: 0,
    oldestDueAt: null,
    lastReviewedAt: null,
  };
  for (const review of languageReviews) {
    if (review.repetitions === 0) languageStatus.new += 1;
    else if (review.repetitions < 3) languageStatus.learning += 1;
    if (review.nextReviewAt.getTime() <= now.getTime()) {
      languageStatus.due += 1;
      const dueIso = review.nextReviewAt.toISOString();
      if (!languageStatus.oldestDueAt || dueIso < languageStatus.oldestDueAt) {
        languageStatus.oldestDueAt = dueIso;
      }
    }
    if (review.lastReviewedAt) {
      const reviewedIso = review.lastReviewedAt.toISOString();
      if (
        !languageStatus.lastReviewedAt ||
        reviewedIso > languageStatus.lastReviewedAt
      ) {
        languageStatus.lastReviewedAt = reviewedIso;
      }
    }
    candidates.push({
      key: `language:${review.id}`,
      source: "language",
      reviewId: review.id,
      wordId: review.wordId,
      storyId: review.storyId,
      repetitions: review.repetitions,
      intervalDays: review.intervalDays,
      nextReviewAt: review.nextReviewAt,
      lastReviewedAt: review.lastReviewedAt,
    });
  }

  const workspaceStatuses = workspaces.map(
    (workspace) => workspaceStatusById.get(workspace.id)!,
  );
  const dueCandidates = candidates
    .filter((candidate) => candidate.nextReviewAt.getTime() <= now.getTime())
    .sort(
      (a, b) =>
        a.nextReviewAt.getTime() - b.nextReviewAt.getTime() ||
        a.key.localeCompare(b.key),
    );
  const totalDue = dueCandidates.length;
  const oldestDue = dueCandidates[0];

  let nextAction: LearningHomeNextAction;
  if (oldestDue?.source === "workspace") {
    const status = workspaceStatusById.get(oldestDue.workspaceId)!;
    nextAction = {
      kind: "workspace",
      workspaceId: status.id,
      workspaceTitle: status.title,
      dueCount: status.due,
      oldestDueAt: oldestDue.nextReviewAt.toISOString(),
      otherDueCount: totalDue - status.due,
      to: `/review?workspaceId=${encodeURIComponent(status.id)}`,
    };
  } else if (oldestDue?.source === "language") {
    nextAction = {
      kind: "language",
      dueCount: languageStatus.due,
      oldestDueAt: oldestDue.nextReviewAt.toISOString(),
      otherDueCount: totalDue - languageStatus.due,
      to: "/language/review",
    };
  } else if (
    candidates.length > 0 ||
    totalLanguageWords > 0 ||
    workspaces.length > 0
  ) {
    nextAction = {
      kind: "done",
      to: workspaces[0] ? `/workspaces/${workspaces[0].id}` : "/language",
    };
  } else {
    nextAction = { kind: "empty", to: "/workspaces" };
  }

  const tomorrowRange = tomorrowWindow(now, timezoneOffsetMinutes);
  const tomorrowWorkspace = candidates.filter(
    (candidate) =>
      candidate.source === "workspace" &&
      candidate.nextReviewAt >= tomorrowRange.start &&
      candidate.nextReviewAt <= tomorrowRange.end,
  ).length;
  const tomorrowLanguage = candidates.filter(
    (candidate) =>
      candidate.source === "language" &&
      candidate.nextReviewAt >= tomorrowRange.start &&
      candidate.nextReviewAt <= tomorrowRange.end,
  ).length;
  const tomorrow: LearningHomeTomorrow = {
    date: tomorrowRange.date,
    total: tomorrowWorkspace + tomorrowLanguage,
    workspace: tomorrowWorkspace,
    language: tomorrowLanguage,
  };

  const reviewedCandidates = candidates.filter(
    (candidate) => candidate.repetitions > 0 && candidate.lastReviewedAt,
  );
  const sparkPool = dueCandidates.length
    ? dueCandidates
    : reviewedCandidates.length
      ? reviewedCandidates
      : candidates;
  const dailyCandidates = orderedDailyCandidates(
    sparkPool,
    `${userId}:${localDayKey(now, timezoneOffsetMinutes)}`,
  );
  const sparkResult = await hydrateFirst(prisma, dailyCandidates, userId);

  const futureReviewedCandidates = reviewedCandidates.filter(
    (candidate) => candidate.nextReviewAt.getTime() > now.getTime(),
  );
  const postcardPool = futureReviewedCandidates.length
    ? futureReviewedCandidates
    : reviewedCandidates;
  const postcardCandidates = postcardPool
    .filter((candidate) => candidate.key !== sparkResult?.candidate.key)
    .sort(
      (a, b) =>
        b.intervalDays - a.intervalDays ||
        (a.lastReviewedAt?.getTime() ?? 0) - (b.lastReviewedAt?.getTime() ?? 0),
    );
  const postcardResult = await hydrateFirst(prisma, postcardCandidates, userId);

  return LearningHomeSnapshotSchema.parse({
    generatedAt: now.toISOString(),
    nextAction,
    workspaceStatuses,
    languageStatus,
    tomorrow,
    spark: sparkResult?.prompt ?? null,
    postcard: postcardResult?.prompt ?? null,
  });
}
