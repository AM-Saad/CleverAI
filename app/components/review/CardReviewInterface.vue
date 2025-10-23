<template>
  <div
    class="max-w-4xl mx-auto p-6 space-y-6"
    tabindex="0"
    role="application"
    aria-label="Spaced repetition card review interface"
    @keydown="handleKeydown"
  >
    <!-- Analytics Summary Card -->
    <ReviewAnalyticsSummary
      v-if="showAnalytics && analytics"
      :analytics="analytics"
      @close="showAnalytics = false"
    />

    <!-- Debug Panel (Development Only) -->
    <div
      v-if="isDev && showDebugPanel && currentCard"
      class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6"
    >
      <div class="flex justify-between items-start mb-4">
        <h2
          class="text-lg font-semibold text-yellow-800 dark:text-yellow-200 flex items-center"
        >
          <Icon name="heroicons:cog-6-tooth" class="w-5 h-5 mr-2" />
          🔧 Debug Controls
        </h2>
        <button
          @click="showDebugPanel = false"
          class="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
        >
          <Icon name="heroicons:x-mark" class="w-5 h-5" />
        </button>
      </div>

      <!-- Current Values Display -->
      <div class="bg-white dark:bg-gray-800 rounded-md p-4 mb-4">
        <h3 class="font-medium text-gray-900 dark:text-gray-100 mb-3">
          Current Values
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-gray-500 dark:text-gray-400">Ease Factor:</span>
            <div class="font-mono font-semibold">
              {{ currentCard.reviewState.easeFactor }}
            </div>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Interval Days:</span>
            <div class="font-mono font-semibold">
              {{ currentCard.reviewState.intervalDays }}
            </div>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Repetitions:</span>
            <div class="font-mono font-semibold">
              {{ currentCard.reviewState.repetitions }}
            </div>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Streak:</span>
            <div class="font-mono font-semibold">
              {{ getStreak(currentCard.reviewState) }}
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
          <div>
            <span class="text-gray-500 dark:text-gray-400">Next Review:</span>
            <div class="font-mono text-xs">
              {{ formatDateTime(currentCard.reviewState.nextReviewAt) }}
            </div>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Last Reviewed:</span>
            <div class="font-mono text-xs">
              {{
                currentCard.reviewState.lastReviewedAt
                  ? formatDateTime(currentCard.reviewState.lastReviewedAt)
                  : "Never"
              }}
            </div>
          </div>
        </div>
      </div>

      <!-- Debug Controls -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <!-- Ease Factor -->
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Ease Factor
          </label>
          <input
            v-model.number="debugValues.easeFactor"
            type="range"
            min="1.3"
            max="5.0"
            step="0.1"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>1.3</span>
            <span class="font-mono font-semibold">{{
              debugValues.easeFactor
            }}</span>
            <span>5.0</span>
          </div>
        </div>

        <!-- Interval Days -->
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Interval Days
          </label>
          <input
            v-model.number="debugValues.intervalDays"
            type="range"
            min="0"
            max="180"
            step="1"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span class="font-mono font-semibold">{{
              debugValues.intervalDays
            }}</span>
            <span>180</span>
          </div>
        </div>

        <!-- Repetitions -->
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Repetitions
          </label>
          <input
            v-model.number="debugValues.repetitions"
            type="range"
            min="0"
            max="20"
            step="1"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span class="font-mono font-semibold">{{
              debugValues.repetitions
            }}</span>
            <span>20</span>
          </div>
        </div>

        <!-- Streak -->
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Streak
          </label>
          <input
            v-model.number="debugValues.streak"
            type="range"
            min="0"
            max="100"
            step="1"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span class="font-mono font-semibold">{{
              debugValues.streak
            }}</span>
            <span>100</span>
          </div>
        </div>
      </div>

      <!-- Date Controls -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Next Review Date
          </label>
          <input
            v-model="debugValues.nextReviewAt"
            type="datetime-local"
            class="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Last Grade (0-5)
          </label>
          <select
            v-model.number="debugValues.lastGrade"
            class="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option :value="undefined">No grade</option>
            <option :value="0">0 - Again</option>
            <option :value="1">1 - Hard</option>
            <option :value="2">2 - Hard</option>
            <option :value="3">3 - Good</option>
            <option :value="4">4 - Good</option>
            <option :value="5">5 - Easy</option>
          </select>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-2">
        <button
          @click="applyDebugValues"
          :disabled="isApplyingDebug"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium transition-colors"
        >
          <Icon
            v-if="isApplyingDebug"
            name="heroicons:arrow-path"
            class="w-4 h-4 mr-2 animate-spin"
          />
          {{ isApplyingDebug ? "Applying..." : "Apply Changes" }}
        </button>

        <button
          @click="resetToCurrentValues"
          class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md font-medium transition-colors"
        >
          Reset to Current
        </button>

        <button
          @click="loadPreset('new')"
          class="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors"
        >
          📝 New Card
        </button>

        <button
          @click="loadPreset('learning')"
          class="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm transition-colors"
        >
          📚 Learning
        </button>

        <button
          @click="loadPreset('mastered')"
          class="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm transition-colors"
        >
          🎓 Mastered
        </button>

        <button
          @click="loadPreset('struggling')"
          class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
        >
          😓 Struggling
        </button>
      </div>
    </div>

    <!-- Header with stats and progress -->
    <div class="flex justify-between items-center">
      <div class="flex items-center space-x-4">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Card Review
        </h1>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ currentCardIndex + 1 }} of {{ reviewQueue.length }}
        </div>
        <!-- Study Session Timer -->
        <div
          class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400"
        >
          <Icon name="heroicons:clock" class="w-4 h-4" />
          <span>{{ formatStudyTime(studySessionTime) }}</span>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <!-- Debug Toggle (Development Only) -->
        <button
          v-if="isDev"
          @click="showDebugPanel = !showDebugPanel"
          class="p-2 text-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-200 rounded-lg transition-colors"
          :aria-label="showDebugPanel ? 'Hide debug panel' : 'Show debug panel'"
          title="Debug Controls"
        >
          <Icon name="heroicons:cog-6-tooth" class="w-5 h-5" />
        </button>

        <!-- Analytics Toggle -->
        <button
          @click="showAnalytics = !showAnalytics"
          class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors"
          :aria-label="showAnalytics ? 'Hide analytics' : 'Show analytics'"
        >
          <Icon name="heroicons:chart-bar" class="w-5 h-5" />
        </button>

        <!-- Stats -->
        <div class="flex space-x-4 text-sm">
          <div class="text-center" aria-label="New cards">
            <div class="font-semibold text-blue-600">{{ queueStats.new }}</div>
            <div class="text-gray-500">New</div>
          </div>
          <div class="text-center" aria-label="Learning cards">
            <div class="font-semibold text-orange-600">
              {{ queueStats.learning }}
            </div>
            <div class="text-gray-500">Learning</div>
          </div>
          <div class="text-center" aria-label="Due cards">
            <div class="font-semibold text-red-600">{{ queueStats.due }}</div>
            <div class="text-gray-500">Due</div>
          </div>
        </div>

        <!-- Progress bar -->
        <div
          class="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Review progress: ${progress}% complete`"
        >
          <div
            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Keyboard Shortcuts Help -->
    <div
      v-if="showShortcuts"
      class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
    >
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Keyboard Shortcuts
          </h3>
          <div
            class="grid grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300"
          >
            <div>
              <kbd class="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 rounded"
                >Space</kbd
              >
              Show Answer
            </div>
            <div>
              <kbd class="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 rounded"
                >1-6</kbd
              >
              Grade Card
            </div>
            <div>
              <kbd class="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 rounded"
                >←/→</kbd
              >
              Navigate
            </div>
            <div>
              <kbd class="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 rounded"
                >S</kbd
              >
              Skip
            </div>
            <div>
              <kbd class="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 rounded"
                >?</kbd
              >
              Toggle Help
            </div>
            <div>
              <kbd class="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 rounded"
                >A</kbd
              >
              Analytics
            </div>
          </div>
        </div>
        <button
          @click="showShortcuts = false"
          class="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
        >
          <Icon name="heroicons:x-mark" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Card Display -->
    <div
      v-if="currentCard"
      class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-all duration-300"
      :class="{ 'animate-pulse': isSubmitting }"
    >
      <!-- Resource Type Badge -->
      <div class="px-6 pt-4">
        <span
          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
          :class="resourceTypeBadgeClass"
        >
          <Icon :name="resourceTypeIcon" class="w-3 h-3 mr-1" />
          {{
            currentCard.resourceType === "flashcard" ? "Flashcard" : "Material"
          }}
        </span>
      </div>

      <!-- Card Content -->
      <div class="p-8">
        <!-- Question/Front -->
        <div class="mb-8">
          <h2 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
            Question
          </h2>
          <div
            class="text-xl font-medium text-gray-900 dark:text-gray-100 leading-relaxed"
            role="heading"
            aria-level="3"
          >
            {{ resourceFront }}
          </div>
        </div>

        <!-- Answer/Back (shown when revealed) -->
        <div v-if="showAnswer" class="border-t pt-8 animate-fade-in">
          <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
            Answer
          </h3>
          <div
            class="text-gray-800 dark:text-gray-200 leading-relaxed prose prose-sm max-w-none"
            role="region"
            aria-label="Card answer"
          >
            <div
              class="whitespace-pre-wrap"
              v-text="formatContent(resourceBack)"
            />
          </div>

          <!-- Hint if available -->
          <div
            v-if="resourceHint"
            class="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
            role="complementary"
            aria-label="Hint"
          >
            <div
              class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1"
            >
              <Icon name="heroicons:light-bulb" class="w-4 h-4 inline mr-1" />
              Hint:
            </div>
            <div class="text-yellow-700 dark:text-yellow-300">
              {{ resourceHint }}
            </div>
          </div>

          <!-- Review State Info -->
          <div
            class="mt-6 grid grid-cols-3 gap-4 text-center text-sm text-gray-500 dark:text-gray-400"
          >
            <div>
              <div class="font-medium">
                {{ currentCard.reviewState.repetitions }}
              </div>
              <div>Reviews</div>
            </div>
            <div>
              <div class="font-medium">
                {{ currentCard.reviewState.easeFactor.toFixed(1) }}
              </div>
              <div>Ease</div>
            </div>
            <div>
              <div class="font-medium">
                {{ currentCard.reviewState.intervalDays }}d
              </div>
              <div>Interval</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="border-t bg-gray-50 dark:bg-gray-700 p-6">
        <div v-if="!showAnswer" class="flex justify-center">
          <button
            @click="revealAnswer"
            class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            :disabled="isSubmitting"
            aria-label="Reveal the answer to this card"
          >
            <Icon name="heroicons:eye" class="w-5 h-5 inline mr-2" />
            Show Answer <span class="text-sm opacity-75">(Space)</span>
          </button>
        </div>

        <div v-else class="space-y-4">
          <!-- Grade Question -->
          <div class="text-center text-gray-700 dark:text-gray-300 font-medium">
            How well did you know this?
          </div>

          <!-- Grade Buttons -->
          <div
            class="grid grid-cols-2 md:grid-cols-6 gap-2"
            role="group"
            aria-label="Grade card options"
          >
            <button
              v-for="(gradeOption, index) in gradeOptions"
              :key="index"
              @click="gradeCard(gradeOption.value)"
              :disabled="isSubmitting"
              class="relative p-3 text-center border rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
              :class="[
                gradeOption.colorClass,
                { 'animate-pulse': isSubmitting },
              ]"
              :aria-label="`Grade ${gradeOption.value}: ${gradeOption.label} - ${gradeOption.description}`"
            >
              <div class="font-semibold">{{ gradeOption.label }}</div>
              <div class="text-xs mt-1">{{ gradeOption.description }}</div>
              <div class="absolute top-1 right-1 text-xs opacity-50">
                {{ index + 1 }}
              </div>
            </button>
          </div>

          <!-- Navigation Buttons -->
          <div class="flex justify-between pt-4">
            <button
              @click="previousCard"
              :disabled="isFirstCard || isSubmitting"
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Go to previous card"
            >
              <Icon name="heroicons:arrow-left" class="w-4 h-4 inline mr-1" />
              Previous
            </button>

            <button
              @click="skipCard"
              :disabled="isSubmitting"
              class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
              aria-label="Skip this card without grading"
            >
              <Icon name="heroicons:forward" class="w-4 h-4 inline mr-1" />
              Skip <span class="text-sm opacity-75">(S)</span>
            </button>

            <button
              @click="nextCard"
              :disabled="isLastCard || isSubmitting"
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Go to next card"
            >
              Next
              <Icon name="heroicons:arrow-right" class="w-4 h-4 inline ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading" class="text-center py-12 animate-fade-in">
      <div class="text-6xl mb-4">🎉</div>
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        All caught up!
      </h2>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        No cards are due for review right now. Great job!
        <span v-if="studySessionReviews > 0">
          You reviewed {{ studySessionReviews }} cards this session.
        </span>
      </p>
      <div class="flex justify-center space-x-4">
        <button
          @click="$emit('refresh')"
          class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Icon name="heroicons:arrow-path" class="w-5 h-5 inline mr-2" />
          Check Again
        </button>
        <button
          @click="showAnalytics = true"
          class="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          <Icon name="heroicons:chart-bar" class="w-5 h-5 inline mr-2" />
          View Analytics
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-12">
      <Loading />
      <p class="text-gray-600 dark:text-gray-400 mt-4">
        Loading review cards...
      </p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="text-center py-12">
      <div class="text-red-600 mb-4">
        <Icon
          name="heroicons:exclamation-triangle"
          class="w-8 h-8 mx-auto mb-2"
        />
        {{ error }}
      </div>
      <button
        @click="clearError"
        class="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        Clear Error
      </button>
    </div>

    <!-- Audio Feedback (disabled until audio files are added) -->
    <!--
        <audio ref="successAudio" preload="auto">
            <source src="/sounds/success.mp3" type="audio/mpeg">
        </audio>
        <audio ref="errorAudio" preload="auto">
            <source src="/sounds/error.mp3" type="audio/mpeg">
        </audio>
        -->
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import type { ReviewGrade } from "~/shared/review.contract";

interface AnalyticsData {
  totalCards: number;
  totalReviews: number;
  currentStreak: number;
  retentionRate: number;
  averageGrade: number;
  gradeDistribution: Record<string, number>;
  performanceMetrics: {
    averageEaseFactor: number;
    averageInterval: number;
    newCards: number;
    learningCards: number;
    dueCards: number;
    masteredCards: number;
  };
}

interface Props {
  folderId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  refresh: [];
  cardGraded: [cardId: string, grade: ReviewGrade];
}>();

// Composable
const {
  reviewQueue,
  currentCard,
  currentCardIndex,
  queueStats,
  isLoading,
  isSubmitting,
  error,
  hasCards,
  isFirstCard,
  isLastCard,
  progress,
  grade,
  fetchQueue,
  nextCard: goToNextCard,
  previousCard: goToPreviousCard,
  clearError,
} = useCardReview();

// Audio feedback refs (disabled until audio files are added)
// const successAudio = ref<HTMLAudioElement>()
// const errorAudio = ref<HTMLAudioElement>()

// Local state for enhanced features
const showAnswer = ref(false);
const showAnalytics = ref(false);
const showShortcuts = ref(false);
const studySessionTime = ref(0);
const studySessionReviews = ref(0);
const sessionStartTime = ref(Date.now());
const analytics = ref<AnalyticsData | null>(null);

// Debug panel state (development only)
const isDev = process.env.NODE_ENV === "development";
const showDebugPanel = ref(false);
const isApplyingDebug = ref(false);
const debugValues = reactive({
  easeFactor: 2.5,
  intervalDays: 1,
  repetitions: 0,
  streak: 0,
  nextReviewAt: "",
  lastGrade: undefined as number | undefined,
});

// Timer for study session
const studyTimer = setInterval(() => {
  studySessionTime.value = Math.floor(
    (Date.now() - sessionStartTime.value) / 1000,
  );
}, 1000);

// Cleanup timer on unmount
onUnmounted(() => {
  clearInterval(studyTimer);
});

// Resource accessors for polymorphic items
const resourceFront = computed(() => {
  const c = currentCard.value;
  if (!c) return "";
  if (c.resourceType === "flashcard") {
    const flashcardResource = c.resource as {
      front: string;
      back: string;
      folderId: string;
      hint?: string;
      tags?: string[];
    };
    return flashcardResource.front;
  }
  const materialResource = c.resource as {
    title: string;
    content: string;
    folderId: string;
    tags?: string[];
  };
  return materialResource.title;
});

const resourceBack = computed(() => {
  const c = currentCard.value;
  if (!c) return "";
  if (c.resourceType === "flashcard") {
    const flashcardResource = c.resource as {
      front: string;
      back: string;
      folderId: string;
      hint?: string;
      tags?: string[];
    };
    return flashcardResource.back;
  }
  const materialResource = c.resource as {
    title: string;
    content: string;
    folderId: string;
    tags?: string[];
  };
  return materialResource.content;
});

const resourceHint = computed(() => {
  const c = currentCard.value;
  if (!c) return undefined;
  if (c.resourceType === "flashcard") {
    const flashcardResource = c.resource as {
      front: string;
      back: string;
      folderId: string;
      hint?: string;
      tags?: string[];
    };
    return flashcardResource.hint;
  }
  return undefined;
});

// UI computed properties
const resourceTypeBadgeClass = computed(() => {
  if (!currentCard.value) return "";
  return currentCard.value.resourceType === "flashcard"
    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
});

const resourceTypeIcon = computed(() => {
  if (!currentCard.value) return "heroicons:document";
  return currentCard.value.resourceType === "flashcard"
    ? "heroicons:rectangle-stack"
    : "heroicons:document-text";
});

// Grade options for SM-2
const gradeOptions = [
  {
    value: "0" as ReviewGrade,
    label: "Again",
    description: "Complete blackout",
    colorClass:
      "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500",
  },
  {
    value: "1" as ReviewGrade,
    label: "Hard",
    description: "Incorrect, easy to recall",
    colorClass:
      "border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 focus:ring-orange-500",
  },
  {
    value: "2" as ReviewGrade,
    label: "Hard",
    description: "Incorrect, difficult to recall",
    colorClass:
      "border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 focus:ring-orange-500",
  },
  {
    value: "3" as ReviewGrade,
    label: "Good",
    description: "Correct, difficult recall",
    colorClass:
      "border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 focus:ring-yellow-500",
  },
  {
    value: "4" as ReviewGrade,
    label: "Good",
    description: "Correct, hesitant",
    colorClass:
      "border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:ring-blue-500",
  },
  {
    value: "5" as ReviewGrade,
    label: "Easy",
    description: "Perfect response",
    colorClass:
      "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 focus:ring-green-500",
  },
];

// Methods
const revealAnswer = () => {
  showAnswer.value = true;
};

const gradeCard = async (gradeValue: ReviewGrade) => {
  if (!currentCard.value) return;

  try {
    await grade(currentCard.value.cardId, gradeValue);
    emit("cardGraded", currentCard.value.cardId, gradeValue);

    // Track session stats
    studySessionReviews.value++;

    // Play audio feedback
    if (parseInt(gradeValue) >= 3) {
      playSuccessSound();
    } else {
      playErrorSound();
    }

    // Reset for next card
    showAnswer.value = false;

    // If no more cards, emit refresh
    if (!hasCards.value) {
      emit("refresh");
    }
  } catch (err) {
    console.error("Failed to grade card:", err);
  }
};

const nextCard = () => {
  showAnswer.value = false;
  goToNextCard();
};

const previousCard = () => {
  showAnswer.value = false;
  goToPreviousCard();
};

const skipCard = () => {
  showAnswer.value = false;
  nextCard();
};

const formatContent = (content: string) => {
  // Enhanced markdown-like formatting with XSS protection
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(
      /`(.*?)`/g,
      '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">$1</code>',
    )
    .replace(/\n/g, "<br>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>',
    );
};

const formatStudyTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const playSuccessSound = () => {
  // Audio feedback disabled until audio files are added
  // if (successAudio.value) {
  //     successAudio.value.play().catch(() => {
  //         // Ignore audio play errors (user interaction required)
  //     })
  // }
};

const playErrorSound = () => {
  // Audio feedback disabled until audio files are added
  // if (errorAudio.value) {
  //     errorAudio.value.play().catch(() => {
  //         // Ignore audio play errors (user interaction required)
  //     })
  // }
};

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  // Prevent shortcuts when typing in inputs
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return;
  }

  switch (event.key) {
    case " ":
    case "Space":
      event.preventDefault();
      if (!showAnswer.value) {
        revealAnswer();
      }
      break;
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
      event.preventDefault();
      if (showAnswer.value) {
        const gradeIndex = parseInt(event.key) - 1;
        if (
          gradeIndex >= 0 &&
          gradeIndex < gradeOptions.length &&
          gradeOptions[gradeIndex]
        ) {
          gradeCard(gradeOptions[gradeIndex].value);
        }
      }
      break;
    case "ArrowLeft":
      event.preventDefault();
      previousCard();
      break;
    case "ArrowRight":
      event.preventDefault();
      nextCard();
      break;
    case "s":
    case "S":
      event.preventDefault();
      skipCard();
      break;
    case "?":
      event.preventDefault();
      showShortcuts.value = !showShortcuts.value;
      break;
    case "a":
    case "A":
      event.preventDefault();
      showAnalytics.value = !showAnalytics.value;
      break;
    case "Escape":
      event.preventDefault();
      showShortcuts.value = false;
      showAnalytics.value = false;
      break;
  }
};

// Utility functions
const getStreak = (reviewState: Record<string, unknown>): number => {
  return (reviewState.streak as number) || 0;
};

// Debug functions (development only)
const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

const resetToCurrentValues = () => {
  if (!currentCard.value) return;

  debugValues.easeFactor = currentCard.value.reviewState.easeFactor;
  debugValues.intervalDays = currentCard.value.reviewState.intervalDays;
  debugValues.repetitions = currentCard.value.reviewState.repetitions;
  debugValues.streak =
    (currentCard.value.reviewState as { streak?: number }).streak || 0;
  debugValues.nextReviewAt = new Date(
    currentCard.value.reviewState.nextReviewAt,
  )
    .toISOString()
    .slice(0, 16);
  debugValues.lastGrade = undefined;
};

const applyDebugValues = async () => {
  if (!currentCard.value || !isDev) return;

  isApplyingDebug.value = true;

  try {
    const updateData: {
      cardId: string;
      easeFactor: number;
      intervalDays: number;
      repetitions: number;
      streak: number;
      nextReviewAt?: string;
      lastGrade?: number;
    } = {
      cardId: currentCard.value.cardId,
      easeFactor: debugValues.easeFactor,
      intervalDays: debugValues.intervalDays,
      repetitions: debugValues.repetitions,
      streak: debugValues.streak,
    };

    if (debugValues.nextReviewAt) {
      updateData.nextReviewAt = new Date(
        debugValues.nextReviewAt,
      ).toISOString();
    }

    if (debugValues.lastGrade !== undefined) {
      updateData.lastGrade = debugValues.lastGrade;
    }

    await $fetch("/api/review/debug/update", {
      method: "POST",
      body: updateData,
    });

    // Refresh the queue to show updated values
    await fetchQueue(props.folderId);

    console.log("✅ Debug values applied successfully");
  } catch (err) {
    console.error("❌ Failed to apply debug values:", err);
  } finally {
    isApplyingDebug.value = false;
  }
};

const loadPreset = (preset: string) => {
  switch (preset) {
    case "new":
      debugValues.easeFactor = 2.5;
      debugValues.intervalDays = 0;
      debugValues.repetitions = 0;
      debugValues.streak = 0;
      debugValues.nextReviewAt = new Date().toISOString().slice(0, 16);
      debugValues.lastGrade = undefined;
      break;

    case "learning":
      debugValues.easeFactor = 2.3;
      debugValues.intervalDays = 6;
      debugValues.repetitions = 2;
      debugValues.streak = 2;
      debugValues.nextReviewAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16);
      debugValues.lastGrade = 3;
      break;

    case "mastered":
      debugValues.easeFactor = 3.2;
      debugValues.intervalDays = 45;
      debugValues.repetitions = 8;
      debugValues.streak = 15;
      debugValues.nextReviewAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16);
      debugValues.lastGrade = 5;
      break;

    case "struggling":
      debugValues.easeFactor = 1.4;
      debugValues.intervalDays = 1;
      debugValues.repetitions = 0;
      debugValues.streak = 0;
      debugValues.nextReviewAt = new Date().toISOString().slice(0, 16);
      debugValues.lastGrade = 1;
      break;
  }
};

// Watch for current card changes to update debug values
watch(
  currentCard,
  (newCard) => {
    if (newCard && isDev) {
      resetToCurrentValues();
    }
  },
  { immediate: true },
);

// Load analytics when analytics panel is opened
const loadAnalytics = async () => {
  if (!analytics.value) {
    try {
      const response = await $fetch("/api/review/analytics", {
        query: props.folderId ? { folderId: props.folderId } : {},
      });
      analytics.value = response.data as AnalyticsData;
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  }
};

// Watch for analytics panel opening
watch(showAnalytics, (newValue) => {
  if (newValue) {
    loadAnalytics();
  }
});

// Watch for prop changes
watch(
  () => props.folderId,
  () => {
    fetchQueue(props.folderId);
    // Reset session stats
    studySessionReviews.value = 0;
    sessionStartTime.value = Date.now();
    studySessionTime.value = 0;
  },
  { immediate: true },
);

// Reset answer visibility when card changes
watch(currentCard, () => {
  showAnswer.value = false;
});

// Focus management for accessibility
onMounted(() => {
  // Focus the main container for keyboard navigation
  nextTick(() => {
    const container = document.querySelector(
      '[role="application"]',
    ) as HTMLElement;
    container?.focus();
  });
});
</script>
