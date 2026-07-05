<template>
  <div class="md">
    <header class="md__header">
      <UiIconButton
        class="md__back"
        icon="i-lucide-chevron-left"
        label="Back"
        @click="goBack"
      />
      <ui-title tag="h1" class="md__title">Material</ui-title>
    </header>

    <div v-if="loading" class="md__list">
      <UiSkeleton class="h-16 w-full rounded-[var(--radius-2xl)]" />
      <UiSkeleton class="h-40 w-full rounded-[var(--radius-2xl)]" />
    </div>

    <template v-else-if="material">
      <!-- source meta -->
      <div class="md__source">
        <span class="md__source-tile" :style="tileStyle">{{ typeLabel }}</span>
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
          pill
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

    <div v-else class="md__empty">
      <UiIcon name="i-lucide-file-x" class="h-9 w-9 text-content-disabled" />
      <p>Material not found.</p>
    </div>

    <!-- generate / result sheet -->
    <UiSheet
      v-model:open="sheetOpen"
      :title="phase === 'result' ? 'Review before adding' : 'Generate'"
    >
      <!-- config -->
      <template v-if="phase === 'config'">
        <div class="gen">
          <div class="gen__toggle">
            <button
              type="button"
              :class="{ 'gen__toggle-btn--on': genType === 'flashcards' }"
              class="gen__toggle-btn"
              @click="genType = 'flashcards'"
            >
              Flashcards
            </button>
            <!-- design-allow: native type toggle -->
            <button
              type="button"
              :class="{ 'gen__toggle-btn--on': genType === 'quiz' }"
              class="gen__toggle-btn"
              @click="genType = 'quiz'"
            >
              Quiz
            </button>
            <!-- design-allow: native type toggle -->
          </div>

          <label class="gen__label"
            >{{ maxItems }}
            {{ genType === "quiz" ? "questions" : "cards" }}</label
          >
          <input
            v-model.number="maxItems"
            type="range"
            min="4"
            max="30"
            step="1"
            class="gen__slider"
          />
          <!-- design-allow: native count slider -->

          <label class="gen__label">Difficulty</label>
          <div class="gen__seg">
            <button
              v-for="d in difficulties"
              :key="d.depth"
              type="button"
              class="gen__seg-btn"
              :class="{ 'gen__seg-btn--on': depth === d.depth }"
              @click="depth = d.depth"
            >
              {{ d.label }}
            </button>
            <!-- design-allow: native difficulty segment -->
          </div>

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
            pill
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
          <UiButton pill block tone="primary" :loading="adding" @click="addAll"
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
import { tint } from "~/composables/useAccentColor";
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

const difficulties = [
  { depth: "quick" as const, label: "Recall" },
  { depth: "balanced" as const, label: "Balanced" },
  { depth: "deep" as const, label: "Exam" },
];

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
const tileStyle = computed(() => {
  const color =
    typeLabel.value === "PDF"
      ? "var(--color-error)"
      : "var(--color-accent-blue)";
  return { background: tint(color, 16), color };
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

function goBack() {
  navigateTo("/materials");
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
.md__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-2);
}
.md__back {
  margin-left: calc(-1 * var(--space-2));
}
.md__title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--color-content-on-surface-strong);
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
  border-radius: var(--radius-2xl);
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
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  border: 1px solid var(--color-secondary);
  box-shadow: var(--shadow-card);
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
  background: linear-gradient(to top, var(--color-background) 70%, transparent);
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
.gen__toggle {
  display: flex;
  gap: 0;
  padding: 4px;
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  margin-bottom: var(--space-2);
}
.gen__toggle-btn {
  flex: 1;
  padding: 9px;
  border-radius: var(--radius-lg);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-content-on-surface);
}
.gen__toggle-btn--on {
  font-weight: 700;
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 0 2px 6px
    color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.gen__label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--color-content-secondary);
  margin-top: var(--space-2);
}
.gen__slider {
  width: 100%;
  accent-color: var(--color-primary);
}
.gen__seg {
  display: flex;
  gap: var(--space-2);
}
.gen__seg-btn {
  flex: 1;
  padding: 9px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
  background: var(--color-background);
  border: 1px solid var(--color-secondary);
  color: var(--color-content-on-surface);
}
.gen__seg-btn--on {
  font-weight: 700;
  background: var(--color-primary-50);
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.gen__quota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
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
  border-radius: var(--radius-2xl);
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
