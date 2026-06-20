<template>
  <UiCard v-if="card"
    variant="surface"
    shadow="md"
    size="md"
    class-name="w-4xl max-w-full mx-auto transition-[box-shadow,transform] duration-300"
    content-classes="p-0">
    <!-- Resource Type Badge -->
    <div class="p-4">
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" :class="resourceTypeBadgeClass">
        <Icon :name="resourceTypeIcon" class="w-3 h-3 mr-1" />
        {{ resourceTypeLabel }}
      </span>
    </div>

    <!-- Card Content -->
    <div class="p-4">
      <!-- Question/Front -->
      <div class="mb-8">
        <div class=" font-medium text-content-on-surface leading-relaxed" role="heading" aria-level="3">
          {{ resourceFront }}
        </div>
      </div>

      <!-- Answer/Back (shown when revealed) -->
      <div v-if="showAnswer" class="border-t border-surface-strong pt-8 animate-fade-in">

        <div class="text-content-on-surface leading-relaxed prose prose-sm max-w-none" role="region"
          aria-label="Card answer">
          <div class="whitespace-pre-wrap" v-html="formattedContent" />
        </div>

        <!-- Hint if available -->
        <UiPanel v-if="resourceHint" class-name="mt-4 border-warning/20 bg-warning/10 dark:bg-warning/5" variant="subtle" size="md"
          role="complementary" aria-label="Hint">
          <div class="text-sm font-medium text-warning-text mb-1">
            <Icon name="i-lucide-lightbulb" class="w-4 h-4 inline mr-1" />
            Hint:
          </div>
          <div class="text-warning-text">
            {{ resourceHint }}
          </div>
        </UiPanel>

        <!-- Review State Info -->
        <CardReviewState :review-state="card.reviewState" />
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import type { ReviewCard } from '~/shared/utils/review.contract'
import type { DeepReadonly } from 'vue'
import CardReviewState from "~/features/review/components/CardReviewState.vue";

interface Props {
  card: ReviewCard | DeepReadonly<ReviewCard>
  showAnswer: boolean
}

const props = defineProps<Props>()

// Use composables for display logic
const cardRef = toRef(props, 'card')
const { resourceFront, resourceBack, resourceHint, resourceTypeBadgeClass, resourceTypeIcon, resourceTypeLabel } =
  useCardDisplay(cardRef)

const { formatContent } = useContentFormatter()

// Format the back content
const formattedContent = computed(() => {
  return formatContent(resourceBack.value)
})
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
