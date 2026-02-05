<template>
  <div v-if="card"
    class="bg-surface rounded-lg shadow-lg overflow-hidden transition-all duration-300  w-4xl max-w-full mx-auto">
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
        <div class=" font-medium text-on-surface leading-relaxed" role="heading" aria-level="3">
          {{ resourceFront }}
        </div>
      </div>

      <!-- Answer/Back (shown when revealed) -->
      <div v-if="showAnswer" class="border-t border-secondary pt-8 animate-fade-in">

        <div class="text-on-surface leading-relaxed prose prose-sm max-w-none" role="region" aria-label="Card answer">
          <div class="whitespace-pre-wrap" v-html="formattedContent" />
        </div>

        <!-- Hint if available -->
        <div v-if="resourceHint" class="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg" role="complementary"
          aria-label="Hint">
          <div class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
            <Icon name="heroicons:light-bulb" class="w-4 h-4 inline mr-1" />
            Hint:
          </div>
          <div class="text-yellow-700 dark:text-yellow-300">
            {{ resourceHint }}
          </div>
        </div>

        <!-- Review State Info -->
        <ReviewCardReviewState :review-state="card.reviewState" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReviewCard } from '~/shared/utils/review.contract'
import type { DeepReadonly } from 'vue'

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
