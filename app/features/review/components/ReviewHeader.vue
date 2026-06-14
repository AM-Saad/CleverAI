<template>
  <div class="flex flex-col ">
    <div class="flex flex-wrap items-center space-x-4 gap-2">
      <ui-subtitle color="content-on-background">
        Review Session
      </ui-subtitle>
      <div class="text-sm text-content-secondary">
        {{ currentIndex + 1 }} of {{ totalCards }}
      </div>
      <!-- Study Session Timer -->
      <ReviewProgressBar :progress="progress" />
    </div>

    <SessionTimer :session-time="sessionTime" />
  </div>
</template>

<script setup lang="ts">
import ReviewProgressBar from "~/features/review/components/ReviewProgressBar.vue";
import SessionTimer from "~/features/review/components/SessionTimer.vue";
interface Props {
  currentIndex: number
  totalCards: number
  progress: number
  /** Session time in seconds - passed from parent to ensure single timer source */
  sessionTime: number
}

defineProps<Props>()
</script>
