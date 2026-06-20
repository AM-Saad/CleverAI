<template>
  <shared-page-wrapper :title="pageTitle" :subtitle="pageSubtitle">
    <template #actions>
      <div class="flex items-center space-x-4">
        <div
          v-if="currentWorkspace"
          class="flex items-center gap-2 text-sm text-content-secondary"
        >
          <Icon name="i-lucide-folder" class="w-4 h-4" />
          <span>{{ currentWorkspace.title }}</span>
          <NuxtLink
            to="/user/review"
            class="text-primary hover:text-primary/70"
            title="Review all workspaces"
          >
            <Icon name="i-lucide-x" class="w-4 h-4" />
          </NuxtLink>
        </div>

        <ui-button
          variant="outline"
          size="sm"
          class="whitespace-nowrap"
          @click="refreshQueue"
        >
          Refresh Queue
        </ui-button>

        <NuxtLink to="/workspaces" class="text-content-on-background text-sm">
          Back to Workspaces
        </NuxtLink>
      </div>
    </template>

    <!-- Language review notification banner -->
    <UiPanel
      v-if="languageDueCount > 0"
      variant="subtle"
      size="md"
      class-name="mb-6 border-primary/20 bg-primary/5"
      content-class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div class="flex items-center gap-2.5 text-sm text-content-on-surface">
        <Icon name="i-lucide-languages" class="w-5 h-5 text-primary shrink-0 animate-pulse" />
        <span>You also have <strong>{{ languageDueCount }}</strong> language cards due for review.</span>
      </div>
      <ui-button size="xs" variant="soft" to="/language/review" class="w-fit">
        Switch to Language Review
      </ui-button>
    </UiPanel>

    <ReviewCardReviewInterface
      :workspace-id="workspaceId"
      @refresh="refreshQueue"
      @card-graded="handleCardGraded"
    />
  </shared-page-wrapper>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, onMounted } from "vue";
import type { ReviewGrade } from "@shared/utils/review.contract";
import { useReviewPage } from "../composables/useReviewPage";

const ReviewCardReviewInterface = defineAsyncComponent(
  () => import("~/features/review/components/CardReviewInterface.vue"),
);

const { $api } = useNuxtApp();
const languageDueCount = ref(0);

const fetchLanguageStats = async () => {
  const result = await $api.language.getStats();
  if (result.success && result.data) {
    languageDueCount.value = result.data.due ?? 0;
  }
};

onMounted(() => {
  fetchLanguageStats();
});

const {
  workspaceId,
  currentWorkspace,
  pageTitle,
  pageSubtitle,
  refreshQueue,
} = useReviewPage();

const handleCardGraded = (_cardId: string, _grade: ReviewGrade) => {
  // Analytics hooks can attach here without growing the route component.
};
</script>
