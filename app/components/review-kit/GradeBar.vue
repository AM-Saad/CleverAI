<template>
  <div class="space-y-2">
    <p v-if="prompt" class="text-center text-sm text-content-secondary">
      {{ prompt }}
    </p>
    <div
      class="grid grid-cols-2 sm:grid-cols-4 gap-2"
      role="group"
      aria-label="Grade this card"
    >
      <UiButton
        v-for="g in REVIEW_GRADES"
        :key="g.value"
        :tone="g.tone"
        variant="soft"
        size="lg"
        block
        :loading="loading"
        :aria-label="`${g.label} — ${g.hint} (key ${g.key})`"
        class="!h-auto !py-2.5 transition-transform duration-100 active:scale-[0.96]"
        @click="emit('grade', g.value)"
      >
        <span class="flex flex-col items-center leading-tight">
          <span class="font-medium">{{ g.label }}</span>
          <span class="text-xs opacity-70">{{ g.hint }}</span>
        </span>
      </UiButton>
    </div>
    <p
      v-if="showKeys"
      class="text-center text-xs text-content-secondary opacity-70"
    >
      Press 1–4 to grade
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * ReviewKitGradeBar — the single, shared grade control for every review surface
 * (normal SR + language). Renders the canonical 4-point scale from grades.ts so
 * the vocabulary is identical everywhere; emits the SM-2 value the API expects.
 */
import { REVIEW_GRADES } from "./grades";
import type { ReviewGrade } from "~/shared/utils/review.contract";

withDefaults(
  defineProps<{
    /** Disable + show loading while a grade is being submitted. */
    loading?: boolean;
    /** Prompt shown above the buttons. Pass an empty string to hide it. */
    prompt?: string;
    /** Show the "press 1–4" keyboard hint (host owns the actual key handling). */
    showKeys?: boolean;
  }>(),
  { loading: false, prompt: "How well did you recall this?", showKeys: false },
);

const emit = defineEmits<{ grade: [value: ReviewGrade] }>();
</script>
