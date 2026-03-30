<script setup lang="ts">
import type { ContextPreview } from "~/composables/useContextBridge";

interface Props {
  preview: ContextPreview;
}

const props = defineProps<Props>();

// Fetch the material (PDF) metadata and content
const { data: material, pending, error } = await useFetch<any>(
  `/api/materials/${props.preview.materialId}`,
  {
    key: `material-context-${props.preview.materialId}`,
  }
);

// Extract the page number from anchor
const targetPage = computed(() => {
  if (!props.preview.anchor) return 1;
  const pageMatch = props.preview.anchor.match(/\d+/);
  return pageMatch ? parseInt(pageMatch[0]) : 1;
});

// Scroll to the target page after PDF loads
const scrollToPage = () => {
  nextTick(() => {
    const pageElement = document.querySelector(
      `[data-page="${targetPage.value}"]`
    );
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      // Highlight effect
      pageElement.classList.add("highlight-page");
      setTimeout(() => {
        pageElement.classList.remove("highlight-page");
      }, 2000);
    }
  });
};

watch(
  () => material.value,
  (newMaterial) => {
    if (newMaterial) {
      scrollToPage();
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Loading -->
    <div v-if="pending" class="flex items-center justify-center p-8">
      <u-icon name="i-lucide-loader" class="w-6 h-6 animate-spin text-primary" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center justify-center p-8 gap-3">
      <u-icon name="i-lucide-alert-circle" class="w-8 h-8 text-error" />
      <ui-paragraph size="sm" color="muted">
        Failed to load PDF content
      </ui-paragraph>
    </div>

    <!-- PDF Content -->
    <div v-else-if="material" class="flex-1 overflow-auto">
      <!-- Material Header -->
      <div class="sticky top-0 bg-surface-100 dark:bg-dark border-b border-muted px-6 py-3 z-10">
        <ui-subtitle size="sm" weight="medium">{{ material.title }}</ui-subtitle>
        <ui-paragraph v-if="material.metadata?.pageCount" size="xs" color="muted">
          {{ material.metadata.pageCount }} pages • Viewing page {{ targetPage }}
        </ui-paragraph>
      </div>

      <!-- PDF Text Content (extracted) -->
      <div class="p-6">
        <!-- Split content by page markers if available -->
        <div v-if="material.content">
          <div v-for="(pageContent, index) in splitContentByPages(material.content)" :key="index" :data-page="index + 1"
            class="page-content mb-8 pb-8 border-b border-muted last:border-b-0">
            <!-- Page Number Badge -->
            <div class="flex items-center gap-2 mb-4">
              <u-badge color="primary" variant="subtle" size="sm">
                Page {{ index + 1 }}
              </u-badge>
            </div>
            <!-- Page Content -->
            <div class="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
              {{ pageContent }}
            </div>
          </div>
        </div>

        <!-- Fallback if no content -->
        <div v-else class="flex flex-col items-center justify-center p-8 gap-3">
          <u-icon name="i-lucide-file-text" class="w-8 h-8 text-muted" />
          <ui-paragraph size="sm" color="muted">
            No content available for this PDF
          </ui-paragraph>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="flex items-center justify-center p-8">
      <ui-paragraph size="sm" color="muted">
        Material not found
      </ui-paragraph>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Split PDF content by page markers [[PAGE:n]]
 * If no markers found, return content as a single page
 */
function splitContentByPages(content: string): string[] {
  if (!content) return [];

  // Look for [[PAGE:n]] markers
  const pageMarkerRegex = /\[\[PAGE:(\d+)\]\]/g;
  const pages: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pageMarkerRegex.exec(content)) !== null) {
    const pageContent = content.substring(lastIndex, match.index).trim();
    if (pageContent) {
      pages.push(pageContent);
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining content
  const remainingContent = content.substring(lastIndex).trim();
  if (remainingContent) {
    pages.push(remainingContent);
  }

  // If no page markers found, return entire content as one page
  return pages.length > 0 ? pages : [content];
}
</script>

<style scoped>
/* Highlight animation for the target page */
:deep(.highlight-page) {
  background-color: rgb(239 246 255 / 1);
  transition: background-color 0.5s;
  animation: pulse-page-highlight 1s ease-in-out;
}

.dark :deep(.highlight-page) {
  background-color: rgb(30 58 138 / 0.2);
}

@keyframes pulse-page-highlight {

  0%,
  100% {
    background-color: rgb(239 246 255 / 1);
  }

  50% {
    background-color: rgb(219 234 254 / 1);
  }
}

.dark @keyframes pulse-page-highlight {

  0%,
  100% {
    background-color: rgb(30 58 138 / 0.2);
  }

  50% {
    background-color: rgb(30 58 138 / 0.3);
  }
}

.page-content {
  scroll-margin-top: 100px;
}
</style>
