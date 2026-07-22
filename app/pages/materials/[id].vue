<template>
  <div class="md">
    <AppPageHeader
      title="Material"
      subtitle="Source and generated study content"
      back-to="/materials"
    />

    <div v-if="loading" class="md__list">
      <UiSkeleton class="h-16 w-full rounded-[var(--component-card-radius)]" />
      <UiSkeleton class="h-40 w-full rounded-[var(--component-card-radius)]" />
    </div>

    <template v-else-if="material">
      <!-- source meta -->
      <div class="md__source">
        <span class="md__source-tile">{{ typeLabel }}</span>
        <div>
          <p class="md__source-name" dir="auto">
            {{ material.title || "Untitled material" }}
          </p>
          <p class="md__source-meta">{{ sourceMeta }}</p>
        </div>
      </div>

      <!-- preview -->
      <section class="md__preview">
        <span class="md__preview-label">SOURCE PREVIEW</span>
        <p class="md__preview-text" dir="auto">{{ previewText }}</p>
        <div class="md__skeleton">
          <span style="width: 92%" /><span style="width: 78%" /><span
            style="width: 60%"
          />
        </div>
      </section>

      <!-- stats -->
      <div class="md__stats">
        <div class="md__stat">
          <span class="md__stat-num">{{ counts.flashcardsCount }}</span
          ><span class="md__stat-label">Flashcards</span>
        </div>
        <div class="md__stat">
          <span class="md__stat-num">{{ counts.questionsCount }}</span
          ><span class="md__stat-label">Quiz</span>
        </div>
      </div>

      <!-- pinned generate -->
      <div class="md__pinned">
        <UiButton
          block
          tone="primary"
          size="lg"
          leading-icon="i-lucide-sparkles"
          @click="openGenerate"
        >
          Generate from this
        </UiButton>
      </div>
    </template>

    <UiEmptyState
      v-else
      icon="i-lucide-file-x"
      title="Material not found"
      description="This material may have been removed or is not available offline."
      action-label="Back to materials"
      @action="navigateTo('/materials')"
    />

    <!-- generate / result sheet -->
    <UiSheet
      v-model:open="sheetOpen"
      :title="phase === 'result' ? 'Review before adding' : 'Generate'"
    >
      <!-- config -->
      <template v-if="phase === 'config'">
        <div class="gen">
          <UiSegmentedControl
            v-model="genType"
            label="Generation type"
            full-width
            :items="genTypeItems"
          />

          <UiLabel tag="label" for="generation-count" class="gen__label"
            >{{ maxItems }}
            {{ genType === "quiz" ? "questions" : "cards" }}</UiLabel
          >
          <input
            id="generation-count"
            v-model.number="maxItems"
            type="range"
            min="4"
            max="30"
            step="1"
            class="gen__slider"
          />
          <!-- design-allow: native count slider -->

          <UiLabel class="gen__label">Difficulty</UiLabel>
          <UiSegmentedControl
            v-model="depth"
            label="Difficulty"
            size="sm"
            full-width
            :items="difficultyItems"
          />

          <div class="gen__quota" :class="{ 'gen__quota--warn': lowQuota }">
            <UiIcon name="i-lucide-info" class="h-4 w-4" />
            <span>{{ quotaText }}</span>
            <NuxtLink v-if="lowQuota" to="/pricing" class="gen__pro"
              >Go Pro</NuxtLink
            >
          </div>
        </div>
      </template>

      <!-- generating / result -->
      <template v-else>
        <div v-if="phase === 'generating'" class="gen__loading">
          <AiShimmer />
          <AiShimmer />
          <p class="gen__loading-text">
            Generating {{ maxItems }}
            {{ genType === "quiz" ? "questions" : "cards" }}…
          </p>
        </div>
        <ul v-else class="gen__result">
          <li v-for="(c, i) in resultCards" :key="i" class="gen__card">
            <span class="gen__check"
              ><UiIcon name="i-lucide-check" class="h-3 w-3"
            /></span>
            <div>
              <p class="gen__q" dir="auto">{{ c.front }}</p>
              <p class="gen__a" dir="auto">{{ c.back }}</p>
            </div>
          </li>
        </ul>
      </template>

      <template #footer>
        <div v-if="phase === 'config'">
          <UiButton
            block
            tone="primary"
            size="lg"
            leading-icon="i-lucide-sparkles"
            :disabled="quotaExceeded"
            @click="runGenerate"
          >
            Generate {{ maxItems }}
            {{ genType === "quiz" ? "questions" : "cards" }}
          </UiButton>
        </div>
        <div v-else-if="phase === 'result'" class="gen__footer">
          <UiButton variant="ghost" tone="neutral" @click="discard"
            >Discard</UiButton
          >
          <UiButton block tone="primary" :loading="adding" @click="addAll"
            >Add all to review</UiButton
          >
        </div>
      </template>
    </UiSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import AiShimmer from "~/components/ui/AiShimmer.vue";
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
import { useGenerateFromMaterial } from "~/features/materials/composables/useGenerateFromMaterial";
import { useSubscriptionStore } from "~/composables/shared/useSubscription";
import type { Material } from "~/shared/utils/material.contract";

const { $api } = useNuxtApp();
const route = useRoute();
const toast = useToast();

const materialId = computed(() => String(route.params.id));
const material = ref<Material | null>(null);
const loading = ref(true);
const counts = ref({ flashcardsCount: 0, questionsCount: 0 });

const gen = useGenerateFromMaterial(materialId);
const subscription = useSubscriptionStore();

const sheetOpen = ref(false);
const phase = ref<"config" | "generating" | "result">("config");
const genType = ref<"flashcards" | "quiz">("flashcards");
const maxItems = ref(12);
const depth = ref<"quick" | "balanced" | "deep">("balanced");
const adding = ref(false);

const genTypeItems = [
  { value: "flashcards", label: "Flashcards" },
  { value: "quiz", label: "Quiz" },
] as const;
const difficultyItems = [
  { value: "quick", label: "Recall" },
  { value: "balanced", label: "Balanced" },
  { value: "deep", label: "Exam" },
] as const;

const remaining = computed(() => subscription.subscriptionInfo.value.remaining);
const tier = computed(() => subscription.subscriptionInfo.value.tier);
const quotaExceeded = computed(() => subscription.isQuotaExceeded.value);
const lowQuota = computed(() => tier.value === "FREE" && remaining.value <= 3);
const quotaText = computed(() =>
  tier.value === "FREE"
    ? `${remaining.value} of ${subscription.subscriptionInfo.value.generationsQuota} free generations left`
    : "Unlimited generations",
);

const resultCards = computed(() => {
  const r = gen.lastResult.value;
  if (!r) return [];
  if (r.type === "flashcards") return r.flashcards ?? [];
  return (r.quiz ?? []).map((q) => ({
    front: q.question,
    back: q.choices[q.answerIndex] ?? "",
  }));
});

const typeLabel = computed(() => {
  const t = (material.value?.type ?? "").toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("image")) return "IMG";
  return "DOC";
});
const sourceMeta = computed(() => {
  const meta = material.value?.metadata as Record<string, unknown> | undefined;
  const pages =
    typeof meta?.pageCount === "number" ? `${meta.pageCount} pages · ` : "";
  const date = material.value?.createdAt
    ? new Date(material.value.createdAt as string).toLocaleDateString(
        undefined,
        { month: "short", day: "numeric" },
      )
    : "";
  return `${pages}uploaded ${date}`;
});
const previewText = computed(() =>
  (material.value?.content ?? "").slice(0, 280),
);

function openGenerate() {
  phase.value = "config";
  gen.lastResult.value = null;
  sheetOpen.value = true;
}

async function runGenerate() {
  phase.value = "generating";
  await gen.startGenerate(genType.value, {
    depth: depth.value,
    maxItems: maxItems.value,
  });
}

watch(
  () => gen.generating.value,
  (now, was) => {
    if (was && !now) {
      phase.value = gen.lastResult.value ? "result" : "config";
      if (gen.genError.value)
        toast.add({ title: gen.genError.value, color: "error" });
    }
  },
);

async function addAll() {
  adding.value = true;
  try {
    const res = await $api.review.enroll({
      resourceType: "material",
      resourceId: materialId.value,
    });
    if (res.success) {
      toast.add({
        title: `Added ${resultCards.value.length} to review`,
        color: "success",
      });
      sheetOpen.value = false;
      await loadCounts();
    } else {
      toast.add({ title: "Couldn't add to review", color: "error" });
    }
  } finally {
    adding.value = false;
  }
}

function discard() {
  gen.lastResult.value = null;
  phase.value = "config";
}

async function loadCounts() {
  const res = await $api.materials.getGeneratedContent(materialId.value);
  if (res.success) counts.value = res.data;
}

onMounted(async () => {
  loading.value = true;
  try {
    const [mat] = await Promise.all([
      $api.materials.getMaterial(materialId.value),
      subscription.fetchSubscriptionStatus(),
      loadCounts(),
    ]);
    if (mat.success) material.value = mat.data;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.md {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) calc(var(--space-8) + 64px);
  min-height: 100dvh;
}
.md__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.md__source {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.md__source-tile {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
.md__source-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--color-content-on-surface-strong);
}
.md__source-meta {
  font-size: 12.5px;
  color: var(--color-content-secondary);
}
.md__preview {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-secondary);
}
.md__preview-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
}
.md__preview-text {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--color-content-on-surface);
  margin-top: var(--space-2);
}
.md__skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: var(--space-3);
}
.md__skeleton span {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-strong);
  display: block;
}
.md__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.md__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--ds-surface-card);
  border: 1px solid var(--color-secondary);
}
.md__stat-num {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--color-content-on-surface-strong);
}
.md__stat-label {
  font-size: 12px;
  color: var(--color-content-secondary);
}
.md__pinned {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(74px + env(safe-area-inset-bottom));
  max-width: 480px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4) var(--space-4);
  background: var(--color-background);
}
.md__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex: 1;
  color: var(--color-content-secondary);
}

/* generate sheet */
.gen {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}
.gen__label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--color-content-secondary);
  margin-top: var(--space-2);
}
.gen__slider {
  height: var(--target-compact);
  width: 100%;
  appearance: none;
  background: transparent;
  outline: none;
}
.gen__slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
}
.gen__slider::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -7px;
  appearance: none;
  border: 2px solid var(--color-background);
  border-radius: var(--radius-full);
  background: var(--color-primary);
}
.gen__slider::-moz-range-track {
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
}
.gen__slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-background);
  border-radius: var(--radius-full);
  background: var(--color-primary);
}
.gen__slider:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 3px;
}
.gen__slider:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.gen__quota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
  font-size: 12.5px;
}
.gen__quota--warn {
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  color: var(--color-warning-text);
}
.gen__pro {
  margin-left: auto;
  font-weight: 800;
  color: var(--color-primary);
}
.gen__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) 0;
}
.gen__loading-text {
  font-size: 13px;
  color: var(--color-content-secondary);
  text-align: center;
}
.gen__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  list-style: none;
  padding: var(--space-2) 0;
  margin: 0;
}
.gen__card {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-secondary);
}
.gen__check {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--color-success);
  color: var(--color-on-success);
  flex-shrink: 0;
}
.gen__q {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-content-on-surface-strong);
}
.gen__a {
  font-size: 13px;
  color: var(--color-content-secondary);
  margin-top: 2px;
}
.gen__footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
