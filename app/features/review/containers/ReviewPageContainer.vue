<template>
  <shared-page-wrapper :title="pageTitle" :subtitle="pageSubtitle">
    <template #actions>
      <div class="flex items-center space-x-4">
        <div
          v-if="currentWorkspace"
          class="flex items-center gap-2 text-sm text-content-secondary"
        >
          <Icon name="heroicons:workspace" class="w-4 h-4" />
          <span>{{ currentWorkspace.title }}</span>
          <NuxtLink
            to="/user/review"
            class="text-primary hover:text-primary/70"
            title="Review all workspaces"
          >
            <Icon name="heroicons:x-mark" class="w-4 h-4" />
          </NuxtLink>
        </div>

        <u-button
          variant="outline"
          size="sm"
          class="whitespace-nowrap"
          @click="refreshQueue"
        >
          Refresh Queue
        </u-button>

        <NuxtLink to="/workspaces" class="text-content-on-background text-sm">
          Back to Workspaces
        </NuxtLink>
      </div>
    </template>

    <ReviewCardReviewInterface
      :workspace-id="workspaceId"
      @refresh="refreshQueue"
      @card-graded="handleCardGraded"
    />
  </shared-page-wrapper>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import type { ReviewGrade } from "@shared/utils/review.contract";
import { useReviewPage } from "../composables/useReviewPage";

const ReviewCardReviewInterface = defineAsyncComponent(
  () => import("~/components/review/CardReviewInterface.vue"),
);

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
