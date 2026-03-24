<template>
  <shared-page-wrapper :title="pageTitle" :subtitle="pageSubtitle">
    <template #actions>
      <div class="flex items-center space-x-4">
        <!-- Workspace indicator if filtering -->
        <div v-if="currentWorkspace" class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Icon name="heroicons:workspace" class="w-4 h-4" />
          <span>{{ currentWorkspace.title }}</span>
          <NuxtLink to="/user/review" class="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            title="Review all workspaces">
            <Icon name="heroicons:x-mark" class="w-4 h-4" />
          </NuxtLink>
        </div>

        <u-button @click="refreshQueue" variant="outline" size="sm" class="whitespace-nowrap">
          Refresh Queue
        </u-button>

        <NuxtLink to="/workspaces" class="text-content-on-background text-sm">
          Back to Workspaces
        </NuxtLink>
      </div>
    </template>

    <!-- Enhanced Review Interface -->
    <ReviewCardReviewInterface :workspace-id="workspaceId" @refresh="refreshQueue" @card-graded="handleCardGraded" />
  </shared-page-wrapper>
</template>

<script setup lang="ts">
const ReviewCardReviewInterface = defineAsyncComponent(
  () => import("~/components/review/CardReviewInterface.vue"),
);

// Get workspace ID from query params
const route = useRoute()
const workspaceId = computed(() => route.query.workspaceId as string | undefined)

// Fetch workspace info if filtering by workspace
const currentWorkspace = ref<{ id: string; title: string } | null>(null)

const fetchWorkspaceInfo = async () => {
  if (!workspaceId.value) {
    currentWorkspace.value = null
    return
  }

  try {
    const { $api } = useNuxtApp()
    const workspace = await $api.workspaces.getWorkspace(workspaceId.value)
    currentWorkspace.value = workspace ? { id: workspace.id, title: workspace.title } : null
  } catch {
    currentWorkspace.value = null
  }
}

// Dynamic page title/subtitle
const pageTitle = computed(() =>
  currentWorkspace.value
    ? `Review: ${currentWorkspace.value.title}`
    : 'Spaced Repetition Review'
)

const pageSubtitle = computed(() =>
  currentWorkspace.value
    ? `Review cards from "${currentWorkspace.value.title}" workspace`
    : 'Review your cards using the spaced repetition algorithm'
)

// SEO
useHead({
  title: computed(() => currentWorkspace.value
    ? `Review ${currentWorkspace.value.title} - Cognilo`
    : "Review Cards - Cognilo"
  ),
  meta: [
    {
      name: "description",
      content: "Review your flashcards using spaced repetition algorithm",
    },
  ],
});

// Get composable for review functionality
const { fetchQueue } = useCardReview();

// Additional methods for this page
const refreshQueue = () => {
  fetchQueue(workspaceId.value);
};

const handleCardGraded = (cardId: string, grade: string) => {
  // Optional: track analytics, show toast, etc.
};

// Watch for workspaceId changes (user navigates between workspace reviews)
watch(workspaceId, () => {
  fetchWorkspaceInfo()
  refreshQueue()
}, { immediate: true })
</script>
