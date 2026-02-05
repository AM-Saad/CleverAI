<template>
  <shared-page-wrapper :title="pageTitle" :subtitle="pageSubtitle">
    <template #actions>
      <div class="flex items-center space-x-4">
        <!-- Folder indicator if filtering -->
        <div v-if="currentFolder" class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Icon name="heroicons:folder" class="w-4 h-4" />
          <span>{{ currentFolder.title }}</span>
          <NuxtLink to="/user/review" class="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            title="Review all folders">
            <Icon name="heroicons:x-mark" class="w-4 h-4" />
          </NuxtLink>
        </div>

        <u-button @click="refreshQueue" variant="outline" size="sm" class="whitespace-nowrap">
          Refresh Queue
        </u-button>

        <NuxtLink to="/folders" class="text-on-background text-sm">
          Back to Folders
        </NuxtLink>
      </div>
    </template>

    <!-- Enhanced Review Interface -->
    <ReviewCardReviewInterface :folder-id="folderId" @refresh="refreshQueue" @card-graded="handleCardGraded" />
  </shared-page-wrapper>
</template>

<script setup lang="ts">
const ReviewCardReviewInterface = defineAsyncComponent(
  () => import("~/components/review/CardReviewInterface.vue"),
);

// Get folder ID from query params
const route = useRoute()
const folderId = computed(() => route.query.folderId as string | undefined)

// Fetch folder info if filtering by folder
const currentFolder = ref<{ id: string; title: string } | null>(null)

const fetchFolderInfo = async () => {
  if (!folderId.value) {
    currentFolder.value = null
    return
  }

  try {
    const { $api } = useNuxtApp()
    const folder = await $api.folders.getFolder(folderId.value)
    currentFolder.value = folder ? { id: folder.id, title: folder.title } : null
  } catch {
    currentFolder.value = null
  }
}

// Dynamic page title/subtitle
const pageTitle = computed(() =>
  currentFolder.value
    ? `Review: ${currentFolder.value.title}`
    : 'Spaced Repetition Review'
)

const pageSubtitle = computed(() =>
  currentFolder.value
    ? `Review cards from "${currentFolder.value.title}" folder`
    : 'Review your cards using the spaced repetition algorithm'
)

// SEO
useHead({
  title: computed(() => currentFolder.value
    ? `Review ${currentFolder.value.title} - Cognilo`
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
  fetchQueue(folderId.value);
};

const handleCardGraded = (cardId: string, grade: string) => {
  // Optional: track analytics, show toast, etc.
};

// Watch for folderId changes (user navigates between folder reviews)
watch(folderId, () => {
  fetchFolderInfo()
  refreshQueue()
}, { immediate: true })
</script>
