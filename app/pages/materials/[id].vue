<template>
  <div class="md">
    <AppPageHeader
      :title="material?.title || 'Material'"
      subtitle="Source and generated study content"
      back-to="/materials"
    >
      <template v-if="material" #actions>
        <UiActionMenu
          :items="materialMenuItems"
          :label="`Actions for ${material.title || 'untitled material'}`"
        />
      </template>
    </AppPageHeader>

    <WorkspacePill v-if="material" class="md__wspill" />

    <div v-if="loading" class="md__list">
      <UiSkeleton class="h-16 w-full rounded-[var(--component-card-radius)]" />
      <UiSkeleton class="h-40 w-full rounded-[var(--component-card-radius)]" />
    </div>

    <UiEmptyState
      v-else-if="loadError"
      icon="triangle-alert"
      title="Couldn't load this material"
      :description="loadError"
      action-label="Try again"
      @action="loadMaterial"
    >
      <template #actions>
        <UiButton size="sm" tone="neutral" variant="ghost" to="/materials">
          Back to materials
        </UiButton>
      </template>
    </UiEmptyState>

    <template v-else-if="material">
      <UiAlert
        v-if="isOffline"
        tone="info"
        icon="cloud-off"
        title="Offline view"
        description="You can read saved material and study items. AI generation will be available after you reconnect."
      />

      <!-- source meta -->
      <div class="md__source">
        <span class="md__source-tile">{{ typeLabel }}</span>
        <div>
          <UiTitle
            tag="div"
            size="base"
            weight="bold"
            tight
            color="content-on-surface-strong"
            dir="auto"
          >
            {{ material.title || "Untitled material" }}
          </UiTitle>
          <UiParagraph size="xs" color="content-secondary">{{
            sourceMeta
          }}</UiParagraph>
        </div>
      </div>

      <!-- preview -->
      <section class="md__preview">
        <UiLabel size="sm" weight="bold" color="content-secondary" uppercase
          >Source preview</UiLabel
        >
        <div
          id="material-source-preview"
          class="md__preview-body"
          :class="{
            'md__preview-body--expanded': previewExpanded,
            'md__preview-body--clipped': previewCanExpand && !previewExpanded,
          }"
        >
          <UiParagraph size="sm" dir="auto" class="md__preview-text">{{
            previewText
          }}</UiParagraph>
        </div>
        <UiButton
          v-if="previewCanExpand"
          tone="neutral"
          variant="link"
          size="sm"
          :trailing-icon="previewExpanded ? 'chevron-up' : 'chevron-down'"
          :aria-expanded="previewExpanded"
          aria-controls="material-source-preview"
          @click="previewExpanded = !previewExpanded"
        >
          {{ previewExpanded ? "See less" : "See more" }}
        </UiButton>
      </section>

      <UiAlert
        v-if="sourceWasTruncated"
        tone="warning"
        icon="triangle-alert"
        title="Only part of this file was imported"
        :description="truncationDescription"
      />

      <UiAlert
        v-if="contentError"
        tone="error"
        icon="triangle-alert"
        title="Study content couldn't be loaded"
        :description="contentError"
      >
        <template #actions>
          <UiButton
            size="xs"
            tone="neutral"
            variant="soft"
            @click="loadGeneratedContent"
          >
            Try again
          </UiButton>
        </template>
      </UiAlert>

      <!-- stats -->
      <!-- <div class="md__stats">
        <div class="md__stat">
          <UiTitle
            tag="div"
            size="2xl"
            weight="extrabold"
            tight
            color="content-on-surface-strong"
            >{{ counts.flashcardsCount }}</UiTitle
          ><UiLabel size="sm" color="content-secondary">Flashcards</UiLabel>
        </div>
        <div class="md__stat">
          <UiTitle
            tag="div"
            size="2xl"
            weight="extrabold"
            tight
            color="content-on-surface-strong"
            >{{ counts.questionsCount }}</UiTitle
          ><UiLabel size="sm" color="content-secondary">Quiz</UiLabel>
        </div>
      </div> -->

      <MaterialStudyContent
        v-if="counts.flashcardsCount > 0 || counts.questionsCount > 0"
        :flashcards="generatedContent.flashcards"
        :questions="generatedContent.questions"
      />

      <!-- pinned generate -->
      <div class="md__pinned">
        <UiButton
          block
          tone="primary"
          size="lg"
          leading-icon="sparkles"
          :disabled="isOffline"
          @click="openGenerate"
        >
          Generate from this
        </UiButton>
      </div>
    </template>

    <UiEmptyState
      v-else
      icon="file-x"
      title="Material not found"
      description="This material may have been removed or is not available offline."
      action-label="Back to materials"
      @action="navigateTo('/materials')"
    />

    <!-- generate / result sheet -->
    <UiSheet
      :open="sheetOpen"
      :title="phase === 'result' ? 'Review before adding' : 'Generate'"
      @update:open="setSheetOpen"
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

          <UiLabel
            tag="label"
            for="generation-count"
            size="sm"
            weight="bold"
            color="content-secondary"
            class="gen__label"
            >{{ maxItems }}
            {{ genType === "quiz" ? "questions" : "cards" }}</UiLabel
          >
          <UiSlider
            id="generation-count"
            v-model="maxItems"
            :min="4"
            :max="30"
            :step="1"
          />

          <UiLabel
            size="sm"
            weight="bold"
            color="content-secondary"
            class="gen__label"
            >Difficulty</UiLabel
          >
          <UiSegmentedControl
            v-model="depth"
            label="Difficulty"
            full-width
            :items="difficultyItems"
          />

          <div class="gen__quota" :class="{ 'gen__quota--warn': lowQuota }">
            <UiIcon name="info" class="h-4 w-4" />
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
          <UiParagraph size="sm" color="content-secondary" center>
            Generating {{ maxItems }}
            {{ genType === "quiz" ? "questions" : "cards" }}…
          </UiParagraph>
        </div>
        <div v-else class="gen__review">
          <UiAlert
            v-if="gen.generationMode.value === 'replace'"
            tone="warning"
            icon="triangle-alert"
            title="Replace mode"
            :description="replaceDraftDescription"
          />

          <div class="gen__review-tools">
            <div class="gen__select-all">
              <UiCheckbox
                v-model="allSelected"
                :label="`Select all ${editableDraftItems.length}`"
              />
              <UiParagraph size="xs" color="content-secondary">
                {{ selectedCount }} selected
              </UiParagraph>
            </div>
            <div class="gen__filters" aria-label="Review item filter">
              <UiButton
                size="xs"
                tone="neutral"
                :variant="reviewFilter === 'all' ? 'soft' : 'ghost'"
                @click="reviewFilter = 'all'"
              >
                All {{ editableDraftItems.length }}
              </UiButton>
              <UiButton
                size="xs"
                tone="neutral"
                :variant="reviewFilter === 'selected' ? 'soft' : 'ghost'"
                @click="reviewFilter = 'selected'"
              >
                Selected {{ selectedCount }}
              </UiButton>
            </div>
          </div>

          <UiAlert
            v-if="invalidSelectedCount > 0"
            tone="error"
            icon="triangle-alert"
            title="Some selected items need attention"
            :description="`Fix empty fields in ${invalidSelectedCount} selected ${invalidSelectedCount === 1 ? 'item' : 'items'} before adding.`"
          />

          <ul class="gen__result">
            <li
              v-for="{ item, index } in visibleDraftItems"
              :key="index"
              class="gen__card"
              :class="{
                'gen__card--excluded':
                  !isSelected(index) && editingIndex !== index,
              }"
            >
              <div class="gen__card-head">
                <div class="gen__card-select">
                  <UiCheckbox
                    :model-value="isSelected(index)"
                    :aria-label="`Include ${item.kind === 'quiz' ? 'question' : 'flashcard'} ${index + 1}`"
                    @update:model-value="setSelected(index, $event === true)"
                  />
                  <UiLabel size="sm" weight="bold" color="content-secondary">
                    {{ item.kind === "quiz" ? "Question" : "Card" }}
                    {{ index + 1 }}
                  </UiLabel>
                </div>
                <UiButton
                  size="xs"
                  tone="neutral"
                  variant="ghost"
                  :leading-icon="editingIndex === index ? 'check' : 'pencil'"
                  @click="toggleEdit(index)"
                >
                  {{ editingIndex === index ? "Done" : "Edit" }}
                </UiButton>
              </div>

              <div class="gen__item-copy">
                <template v-if="editingIndex === index">
                  <div v-if="item.kind === 'flashcard'" class="gen__edit">
                    <UiFormField
                      label="Front"
                      :error="fieldError(item.front, 'Front')"
                      required
                    >
                      <UiTextarea
                        v-model="item.front"
                        :rows="2"
                        :maxrows="5"
                        autoresize
                        maxlength="10000"
                        :error="!item.front.trim()"
                      />
                    </UiFormField>
                    <UiFormField
                      label="Back"
                      :error="fieldError(item.back, 'Back')"
                      required
                    >
                      <UiTextarea
                        v-model="item.back"
                        :rows="3"
                        :maxrows="7"
                        autoresize
                        maxlength="20000"
                        :error="!item.back.trim()"
                      />
                    </UiFormField>
                  </div>
                  <div v-else class="gen__edit">
                    <UiFormField
                      label="Question"
                      :error="fieldError(item.question, 'Question')"
                      required
                    >
                      <UiTextarea
                        v-model="item.question"
                        :rows="2"
                        :maxrows="5"
                        autoresize
                        maxlength="10000"
                        :error="!item.question.trim()"
                      />
                    </UiFormField>
                    <fieldset class="gen__choice-editor">
                      <legend>Answer choices</legend>
                      <div
                        v-for="(_, choiceIndex) in item.choices"
                        :key="choiceIndex"
                        class="gen__choice-edit"
                      >
                        <UiInput
                          v-model="item.choices[choiceIndex]"
                          :aria-label="`Choice ${choiceLetter(choiceIndex)}`"
                          maxlength="10000"
                          :error="!item.choices[choiceIndex]?.trim()"
                        />
                        <UiButton
                          size="xs"
                          :tone="
                            item.answerIndex === choiceIndex
                              ? 'primary'
                              : 'neutral'
                          "
                          :variant="
                            item.answerIndex === choiceIndex ? 'soft' : 'ghost'
                          "
                          :aria-pressed="item.answerIndex === choiceIndex"
                          @click="item.answerIndex = choiceIndex"
                        >
                          {{
                            item.answerIndex === choiceIndex
                              ? "Correct"
                              : "Mark correct"
                          }}
                        </UiButton>
                      </div>
                    </fieldset>
                  </div>
                </template>

                <template v-else>
                  <UiParagraph
                    size="sm"
                    weight="bold"
                    color="content-on-surface-strong"
                    dir="auto"
                  >
                    {{ item.kind === "flashcard" ? item.front : item.question }}
                  </UiParagraph>
                  <UiParagraph
                    v-if="item.kind === 'flashcard'"
                    size="sm"
                    color="content-secondary"
                    dir="auto"
                    class="gen__a"
                  >
                    {{ item.back }}
                  </UiParagraph>
                  <ol v-else class="gen__choices">
                    <li
                      v-for="(choice, choiceIndex) in item.choices"
                      :key="choiceIndex"
                      :class="{
                        'gen__choice--correct':
                          choiceIndex === item.answerIndex,
                      }"
                    >
                      <span>{{ choiceLetter(choiceIndex) }}</span>
                      <span dir="auto">{{ choice }}</span>
                      <UiIcon
                        v-if="choiceIndex === item.answerIndex"
                        name="check"
                        class="h-3 w-3"
                        aria-label="Correct answer"
                      />
                    </li>
                  </ol>
                </template>
              </div>
            </li>
          </ul>

          <UiEmptyState
            v-if="reviewFilter === 'selected' && selectedCount === 0"
            icon="list-checks"
            title="No items selected"
            description="Switch to All and choose items to add."
            action-label="Show all"
            @action="reviewFilter = 'all'"
          />
        </div>
      </template>

      <template #footer>
        <div v-if="phase === 'config'">
          <UiButton
            block
            tone="primary"
            size="lg"
            leading-icon="sparkles"
            :loading="gen.preparing.value"
            :disabled="isOffline"
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
          <UiButton
            block
            tone="primary"
            :loading="adding"
            :disabled="!canCommitDraft"
            @click="addSelected"
          >
            Add {{ selectedCount }} to review
          </UiButton>
        </div>
      </template>
    </UiSheet>

    <UiModal
      v-model:open="gen.showConfirmDialog.value"
      title="This material already has study items"
      :description="existingContentDescription"
      icon="copy"
      @close="gen.cancelRegenerate"
    >
      <UiParagraph size="sm" color="content-secondary">
        Choose whether the new draft should be added alongside the existing
        items or replace them after you review and confirm it.
      </UiParagraph>
      <template #footer>
        <div class="gen__confirm-actions">
          <UiButton
            tone="neutral"
            variant="ghost"
            @click="gen.cancelRegenerate"
          >
            Cancel
          </UiButton>
          <UiButton
            tone="neutral"
            variant="soft"
            @click="confirmGeneration(false)"
          >
            Add alongside
          </UiButton>
          <UiButton tone="error" @click="confirmGeneration(true)">
            Replace existing
          </UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal
      v-model:open="renameOpen"
      title="Rename material"
      description="Use a clear name you can recognize later."
      icon="pencil"
      @close="closeRename"
    >
      <UiFormField
        label="Material name"
        :error="renameError ?? undefined"
        required
      >
        <UiInput
          v-model="renameTitle"
          autofocus
          maxlength="240"
          :error="Boolean(renameError)"
          @keydown.enter="saveRename"
        />
      </UiFormField>
      <template #footer>
        <div class="gen__confirm-actions">
          <UiButton tone="neutral" variant="ghost" @click="closeRename">
            Cancel
          </UiButton>
          <UiButton
            tone="primary"
            :loading="savingName"
            :disabled="!renameTitle.trim()"
            @click="saveRename"
          >
            Save name
          </UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal
      v-model:open="deleteOpen"
      title="Delete this material?"
      :description="deleteDescription"
      icon="trash-2"
      @close="closeDelete"
    >
      <UiAlert
        tone="warning"
        icon="triangle-alert"
        title="Study data will be removed"
        :description="deleteStudyDescription"
      />
      <template #footer>
        <div class="gen__confirm-actions">
          <UiButton tone="neutral" variant="ghost" @click="closeDelete">
            Cancel
          </UiButton>
          <UiButton tone="error" :loading="deleting" @click="deleteMaterial">
            {{ isOffline ? "Delete when online" : "Delete material" }}
          </UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AiShimmer from "~/components/ui/AiShimmer.vue";
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
import WorkspacePill from "~/components/shell/WorkspacePill.vue";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import MaterialStudyContent from "~/features/materials/components/MaterialStudyContent.vue";
import { useGenerateFromMaterial } from "~/features/materials/composables/useGenerateFromMaterial";
import { useSubscriptionStore } from "~/composables/shared/useSubscription";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import {
  getOfflineEntity,
  listOfflineEntities,
  putOfflineEntities,
  replaceOfflineEntityCollection,
} from "~/utils/offline-v2/repository";
import type {
  Material,
  MaterialGeneratedContent,
} from "~/shared/utils/material.contract";
import type {
  FlashcardDTO,
  QuizQuestionDTO,
} from "~/shared/utils/llm-generate.contract";

type EditableFlashcard = FlashcardDTO & { kind: "flashcard" };
type EditableQuizQuestion = QuizQuestionDTO & { kind: "quiz" };
type EditableDraftItem = EditableFlashcard | EditableQuizQuestion;

const { $api } = useNuxtApp();
const route = useRoute();
const toast = useToast();
const offline = useOfflineRuntime();
const { setActive } = useActiveWorkspace();

const materialId = computed(() => String(route.params.id));
const material = ref<Material | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const contentError = ref<string | null>(null);
const generatedContent = ref<MaterialGeneratedContent>(emptyGeneratedContent());
const counts = computed(() => ({
  flashcardsCount: generatedContent.value.flashcardsCount,
  questionsCount: generatedContent.value.questionsCount,
}));

const gen = useGenerateFromMaterial(materialId);
const subscription = useSubscriptionStore();

const sheetOpen = ref(false);
const phase = ref<"config" | "generating" | "result">("config");
const genType = ref<"flashcards" | "quiz">("flashcards");
const maxItems = ref(12);
const depth = ref<"quick" | "balanced" | "deep">("balanced");
const adding = ref(false);
const previewExpanded = ref(false);
const selectedIndices = ref<number[]>([]);
const editableDraftItems = ref<EditableDraftItem[]>([]);
const editingIndex = ref<number | null>(null);
const reviewFilter = ref<"all" | "selected">("all");
const renameOpen = ref(false);
const renameTitle = ref("");
const renameError = ref<string | null>(null);
const savingName = ref(false);
const deleteOpen = ref(false);
const deleting = ref(false);
const isOffline = computed(() => !offline.isOnline.value);

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
const lowQuota = computed(() => tier.value === "FREE" && remaining.value <= 3);
const quotaText = computed(() =>
  tier.value === "FREE"
    ? `${remaining.value} of ${subscription.subscriptionInfo.value.generationsQuota} free generations left`
    : "Unlimited generations",
);

const selectedCount = computed(() => selectedIndices.value.length);
const visibleDraftItems = computed(() =>
  editableDraftItems.value
    .map((item, index) => ({ item, index }))
    .filter(
      ({ index }) =>
        reviewFilter.value === "all" || selectedIndices.value.includes(index),
    ),
);
const invalidSelectedCount = computed(
  () =>
    selectedIndices.value.filter(
      (index) => !isDraftItemValid(editableDraftItems.value[index]),
    ).length,
);
const canCommitDraft = computed(
  () => selectedCount.value > 0 && invalidSelectedCount.value === 0,
);
const allSelected = computed<boolean | "indeterminate">({
  get() {
    if (selectedCount.value === 0) return false;
    if (selectedCount.value === editableDraftItems.value.length) return true;
    return "indeterminate";
  },
  set(value) {
    selectedIndices.value =
      value === true ? editableDraftItems.value.map((_, index) => index) : [];
  },
});
const materialMenuItems = computed(() => [
  [
    {
      id: "rename-material",
      label: "Rename",
      icon: "pencil",
      onSelect: openRename,
    },
  ],
  [
    {
      id: "delete-material",
      label: "Delete",
      icon: "trash-2",
      color: "error",
      onSelect: () => {
        deleteOpen.value = true;
      },
    },
  ],
]);
const deleteDescription = computed(() => {
  const name = material.value?.title || "Untitled material";
  return isOffline.value
    ? `"${name}" will disappear now and be deleted everywhere after you reconnect.`
    : `"${name}" will be permanently deleted.`;
});
const deleteStudyDescription = computed(() => {
  const count = counts.value.flashcardsCount + counts.value.questionsCount;
  if (count === 0) return "This source file will be permanently deleted.";
  return `${count} generated ${count === 1 ? "item" : "items"} and associated review progress will also be deleted.`;
});

const typeLabel = computed(() => {
  const type = (material.value?.type ?? "").toLowerCase();
  if (type.includes("pdf")) return "PDF";
  if (type.includes("docx") || type.includes("document")) return "DOCX";
  if (type.includes("txt") || type.includes("text")) return "TXT";
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
const sourceWasTruncated = computed(() => {
  const meta = material.value?.metadata as Record<string, unknown> | undefined;
  return meta?.truncated === true;
});
const truncationDescription = computed(() => {
  const meta = material.value?.metadata as Record<string, unknown> | undefined;
  const imported =
    typeof meta?.charCount === "number"
      ? meta.charCount.toLocaleString()
      : "100,000";
  const original =
    typeof meta?.originalCharCount === "number"
      ? meta.originalCharCount.toLocaleString()
      : null;
  return original
    ? `${imported} of ${original} characters are available for preview and generation.`
    : `${imported} characters are available for preview and generation.`;
});
const fullSourceText = computed(() => material.value?.content ?? "");
const previewCanExpand = computed(() => fullSourceText.value.length > 280);
const previewText = computed(() =>
  previewExpanded.value
    ? fullSourceText.value
    : fullSourceText.value.slice(0, 280),
);
const existingContentDescription = computed(() => {
  const count =
    gen.pendingGenerationType.value === "quiz"
      ? gen.existingCounts.value.questionsCount
      : gen.existingCounts.value.flashcardsCount;
  const noun =
    gen.pendingGenerationType.value === "quiz" ? "questions" : "flashcards";
  return `${count} existing ${noun} were generated from this material.`;
});
const replaceDraftDescription = computed(() => {
  const count =
    genType.value === "quiz"
      ? gen.existingCounts.value.questionsCount
      : gen.existingCounts.value.flashcardsCount;
  const noun = genType.value === "quiz" ? "questions" : "flashcards";
  return `Adding this selection will remove ${count} existing ${noun} and their review progress.`;
});

function emptyGeneratedContent(): MaterialGeneratedContent {
  return {
    flashcardsCount: 0,
    questionsCount: 0,
    flashcards: [],
    questions: [],
  };
}

function openGenerate() {
  if (isOffline.value) {
    toast.add({
      title: "Generation needs a connection",
      description: "Reconnect to generate new study items.",
      color: "warning",
    });
    return;
  }
  phase.value = "config";
  gen.lastResult.value = null;
  editableDraftItems.value = [];
  editingIndex.value = null;
  reviewFilter.value = "all";
  sheetOpen.value = true;
}

function setSheetOpen(open: boolean) {
  if (open || phase.value === "config") {
    sheetOpen.value = open;
    return;
  }
  toast.add({
    title:
      phase.value === "generating"
        ? "Generation is still running"
        : "Choose Add or Discard",
    description:
      phase.value === "generating"
        ? "Keep this panel open until your draft is ready."
        : "Your reviewed draft stays open so an accidental swipe doesn't lose it.",
    color: "warning",
  });
}

async function runGenerate() {
  await gen.startGenerate(genType.value, {
    depth: depth.value,
    maxItems: maxItems.value,
  });
  if (gen.genError.value) {
    toast.add({ title: gen.genError.value, color: "error" });
  }
}

async function confirmGeneration(replace: boolean) {
  await gen.confirmRegenerate(replace);
  if (gen.genError.value) {
    toast.add({ title: gen.genError.value, color: "error" });
  }
}

watch(
  () => gen.generating.value,
  (now, was) => {
    if (now) {
      phase.value = "generating";
      return;
    }
    if (was) {
      phase.value = gen.lastResult.value ? "result" : "config";
    }
  },
);

watch(
  () => gen.lastResult.value,
  (result) => {
    if (!result) {
      editableDraftItems.value = [];
      selectedIndices.value = [];
      editingIndex.value = null;
      return;
    }
    editableDraftItems.value =
      result.type === "flashcards"
        ? (result.flashcards ?? []).map((card) => ({
            ...card,
            kind: "flashcard" as const,
          }))
        : (result.quiz ?? []).map((question) => ({
            ...question,
            choices: [...question.choices],
            kind: "quiz" as const,
          }));
    selectedIndices.value = editableDraftItems.value.map((_, index) => index);
    editingIndex.value = null;
    reviewFilter.value = "all";
  },
);

function isDraftItemValid(
  item: EditableDraftItem | undefined,
): item is EditableDraftItem {
  if (!item) return false;
  if (item.kind === "flashcard") {
    return Boolean(item.front.trim() && item.back.trim());
  }
  return Boolean(
    item.question.trim() &&
    item.choices.length === 4 &&
    item.choices.every((choice) => choice.trim()) &&
    item.answerIndex >= 0 &&
    item.answerIndex < item.choices.length,
  );
}

function fieldError(value: string, label: string) {
  return value.trim() ? undefined : `${label} can't be empty.`;
}

function toggleEdit(index: number) {
  editingIndex.value = editingIndex.value === index ? null : index;
}

function isSelected(index: number) {
  return selectedIndices.value.includes(index);
}

function setSelected(index: number, selected: boolean) {
  const next = new Set(selectedIndices.value);
  if (selected) next.add(index);
  else next.delete(index);
  selectedIndices.value = Array.from(next).sort((a, b) => a - b);
}

function choiceLetter(index: number) {
  return String.fromCharCode(65 + index);
}

async function addSelected() {
  const draft = gen.lastResult.value;
  if (!draft || !canCommitDraft.value) return;

  adding.value = true;
  try {
    const selected = new Set(selectedIndices.value);
    const response =
      draft.type === "flashcards"
        ? await $api.materials.commitGeneratedContent(materialId.value, {
            task: "flashcards",
            mode: gen.generationMode.value,
            items: editableDraftItems.value
              .filter(
                (item, index): item is EditableFlashcard =>
                  selected.has(index) && item.kind === "flashcard",
              )
              .map(({ kind: _kind, ...item }) => ({
                ...item,
                front: item.front.trim(),
                back: item.back.trim(),
              })),
          })
        : await $api.materials.commitGeneratedContent(materialId.value, {
            task: "quiz",
            mode: gen.generationMode.value,
            items: editableDraftItems.value
              .filter(
                (item, index): item is EditableQuizQuestion =>
                  selected.has(index) && item.kind === "quiz",
              )
              .map(({ kind: _kind, ...item }) => ({
                ...item,
                question: item.question.trim(),
                choices: item.choices.map((choice) => choice.trim()),
              })),
          });

    if (!response.success) {
      toast.add({
        title: "Couldn't add items to review",
        description: response.error.message,
        color: "error",
      });
      return;
    }

    toast.add({
      title: `Added ${response.data.savedCount} to review`,
      description:
        response.data.deletedCount && response.data.deletedCount > 0
          ? `Replaced ${response.data.deletedCount} existing items.`
          : undefined,
      color: "success",
    });
    sheetOpen.value = false;
    gen.lastResult.value = null;
    await loadGeneratedContent();
  } finally {
    adding.value = false;
  }
}

function discard() {
  gen.lastResult.value = null;
  editableDraftItems.value = [];
  selectedIndices.value = [];
  editingIndex.value = null;
  reviewFilter.value = "all";
  phase.value = "config";
  sheetOpen.value = false;
}

function openRename() {
  renameTitle.value = material.value?.title ?? "";
  renameError.value = null;
  renameOpen.value = true;
}

function closeRename() {
  if (savingName.value) return;
  renameOpen.value = false;
  renameTitle.value = "";
  renameError.value = null;
}

async function saveRename() {
  const current = material.value;
  const title = renameTitle.value.trim();
  if (!current || savingName.value) return;
  if (!title) {
    renameError.value = "Enter a material name.";
    return;
  }
  if (title === current.title) {
    closeRename();
    return;
  }

  savingName.value = true;
  renameError.value = null;
  try {
    let updated: Material;
    if (isOffline.value) {
      updated = {
        ...current,
        title,
        updatedAt: new Date().toISOString(),
      };
      await offline.queue({
        entity: "material",
        operation: "material.update",
        entityId: current.id,
        workspaceId: current.workspaceId,
        changedFields: ["title"],
        payload: { title },
        localData: updated as unknown as Record<string, unknown>,
      });
    } else {
      const response = await $api.materials.update(current.id, { title });
      if (!response.success) {
        renameError.value = response.error.message;
        return;
      }
      updated = response.data;
      await cacheMaterialSnapshot(updated);
    }

    material.value = updated;
    renameOpen.value = false;
    renameTitle.value = "";
    toast.add({
      title: "Material renamed",
      description: isOffline.value
        ? "Change will sync after you reconnect."
        : undefined,
      color: "success",
    });
  } catch (error) {
    renameError.value =
      error instanceof Error ? error.message : "Couldn't rename material.";
  } finally {
    savingName.value = false;
  }
}

function closeDelete() {
  if (deleting.value) return;
  deleteOpen.value = false;
}

async function deleteMaterial() {
  const current = material.value;
  if (!current || deleting.value) return;
  deleting.value = true;
  try {
    if (isOffline.value) {
      await offline.queue({
        entity: "material",
        operation: "material.delete",
        entityId: current.id,
        workspaceId: current.workspaceId,
        changedFields: ["deleted"],
        payload: {},
      });
      toast.add({
        title: "Material removed",
        description: "Deletion will sync after you reconnect.",
        color: "warning",
      });
    } else {
      const response = await $api.materials.delete(current.id);
      if (!response.success) {
        toast.add({
          title: "Couldn't delete material",
          description: response.error.message,
          color: "error",
        });
        return;
      }
      toast.add({ title: "Material deleted", color: "success" });
    }
    deleteOpen.value = false;
    await navigateTo("/materials");
  } catch (error) {
    toast.add({
      title: "Couldn't delete material",
      description: error instanceof Error ? error.message : "Please try again.",
      color: "error",
    });
  } finally {
    deleting.value = false;
  }
}

async function cacheGeneratedContent(content: MaterialGeneratedContent) {
  if (!offline.accountId.value || !material.value) return;
  const accountId = offline.accountId.value;
  const workspaceId = material.value.workspaceId;
  const records = [...content.flashcards, ...content.questions].map((item) => ({
    id: `${accountId}:studyContent:${item.id}`,
    accountId,
    entity: "studyContent" as const,
    entityId: item.id,
    workspaceId,
    version: 0,
    updatedAt: Date.now(),
    data: {
      ...item,
      workspaceId,
      materialId: materialId.value,
    } as unknown as Record<string, unknown>,
  }));
  try {
    await replaceOfflineEntityCollection({
      accountId,
      entity: "studyContent",
      workspaceId,
      foreignKey: "materialId",
      foreignId: materialId.value,
      records,
    });
  } catch (error) {
    console.warn("Couldn't refresh offline material study content", error);
  }
}

async function cacheMaterialSnapshot(item: Material) {
  if (!offline.accountId.value) return;
  try {
    await putOfflineEntities([
      {
        id: `${offline.accountId.value}:material:${item.id}`,
        accountId: offline.accountId.value,
        entity: "material",
        entityId: item.id,
        workspaceId: item.workspaceId,
        version: 0,
        updatedAt: Date.now(),
        data: item as unknown as Record<string, unknown>,
      },
    ]);
  } catch (error) {
    console.warn("Couldn't refresh offline material snapshot", error);
  }
}

async function loadGeneratedContent() {
  contentError.value = null;

  if (isOffline.value) {
    if (!offline.accountId.value || !material.value) {
      generatedContent.value = emptyGeneratedContent();
      return;
    }
    const stored = await listOfflineEntities<Record<string, unknown>>(
      offline.accountId.value,
      "studyContent",
      material.value.workspaceId,
    );
    const relevant = stored
      .map((record) => record.data)
      .filter((item) => item.materialId === materialId.value);
    const flashcards = relevant.filter(
      (item) => typeof item.front === "string",
    ) as unknown as MaterialGeneratedContent["flashcards"];
    const questions = relevant.filter(
      (item) => typeof item.question === "string",
    ) as unknown as MaterialGeneratedContent["questions"];
    generatedContent.value = {
      flashcardsCount: flashcards.length,
      questionsCount: questions.length,
      flashcards,
      questions,
    };
    return;
  }

  const response = await $api.materials.getGeneratedContent(materialId.value);
  if (!response.success) {
    contentError.value = response.error.message;
    return;
  }
  generatedContent.value = response.data;
  await cacheGeneratedContent(response.data);
}

async function loadMaterial() {
  loading.value = true;
  loadError.value = null;
  contentError.value = null;
  material.value = null;
  generatedContent.value = emptyGeneratedContent();

  try {
    if (isOffline.value) {
      if (!offline.accountId.value) {
        loadError.value =
          "Sign in while online once before using saved materials offline.";
        return;
      }
      const cached = await getOfflineEntity<Material>(
        offline.accountId.value,
        "material",
        materialId.value,
      );
      if (!cached) {
        loadError.value =
          "This material hasn't been downloaded for offline use.";
        return;
      }
      material.value = cached.data;
      setActive(cached.data.workspaceId);
    } else {
      const response = await $api.materials.getMaterial(materialId.value);
      if (!response.success) {
        if (response.error.status !== 404) {
          loadError.value = response.error.message;
        }
        return;
      }
      material.value = response.data;
      setActive(response.data.workspaceId);
      await cacheMaterialSnapshot(response.data);
    }

    await Promise.all([
      isOffline.value
        ? Promise.resolve()
        : subscription.fetchSubscriptionStatus(),
      loadGeneratedContent(),
    ]);
  } catch (error) {
    loadError.value =
      error instanceof Error
        ? error.message
        : "This material couldn't be loaded. Please try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadMaterial();

  // Land straight in the generate sheet when arriving from share-target.
  if (route.query.openGenerate && material.value && !isOffline.value) {
    openGenerate();
    const { openGenerate: _openGenerate, ...query } = route.query;
    void _openGenerate;
    await navigateTo({ path: route.path, query }, { replace: true });
  }
});

watch(materialId, () => {
  previewExpanded.value = false;
  void loadMaterial();
});
watch(isOffline, (now, was) => {
  if (was && !now) void loadMaterial();
});
</script>

<style scoped>
.md {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  /* Extra 64px clears the fixed generate bar. */
  padding-bottom: calc(var(--space-6) + 64px);
  min-height: 100dvh;
}

.md__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.md__wspill {
  align-self: flex-start;
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

.md__preview {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-secondary);
}

.md__preview-text {
  margin-top: var(--space-2);
  white-space: pre-wrap;
}

/* Collapsed previews are sliced at a fixed character count, so they stop
   mid-word with nothing to say so. Fading the tail reads as "cut off, there is
   more" and pairs with the See more button below. Only applied when there is
   actually more — a short source that fits needs no signal. */
.md__preview-body--clipped {
  mask-image: var(--mask-fade-bottom);
  -webkit-mask-image: var(--mask-fade-bottom);
}

.md__preview-body--expanded {
  max-height: 320px;
  padding-right: var(--space-2);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  mask-image: var(--mask-fade-y);
  -webkit-mask-image: var(--mask-fade-y);
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

.md__pinned {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(74px + env(safe-area-inset-bottom));
  /* Match the shell column's max-width (layouts/default.vue) so this doesn't look narrower than the page content on wide viewports. */
  max-width: 680px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4) var(--space-4);
  background: var(--color-background);
  z-index: var(--z-popover);
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
  margin-top: var(--space-2);
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

.gen__review {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.gen__review-tools {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-secondary);
}

.gen__select-all {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.gen__filters,
.gen__card-head,
.gen__card-select {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.gen__filters {
  flex-wrap: wrap;
}

.gen__card-head {
  justify-content: space-between;
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
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-secondary);
}

.gen__card--excluded {
  opacity: 0.58;
}

.gen__item-copy {
  min-width: 0;
  flex: 1;
}

.gen__edit {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.gen__choice-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: 0;
  border: 0;
}

.gen__choice-editor legend {
  margin-bottom: var(--space-2);
  color: var(--color-content-secondary);
  font-size: 13px;
  font-weight: 700;
}

.gen__choice-edit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 104px;
  align-items: center;
  gap: var(--space-2);
}

.gen__a {
  margin-top: 2px;
}

.gen__choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) 0 0;
  margin: 0;
  list-style: none;
}

.gen__choices li {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: start;
  gap: var(--space-2);
  color: var(--color-content-secondary);
  font-size: 13px;
}

.gen__choice--correct {
  color: var(--color-success-text);
  font-weight: 700;
}

.gen__footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.gen__confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 420px) {
  .gen__choice-edit {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
}
</style>
