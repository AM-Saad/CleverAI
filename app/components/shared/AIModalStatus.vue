<script setup lang="ts">
import { useAIStore } from '~/composables/ai';

const store = useAIStore('global-ai-store');
const { modelsList } = store;

// ── Collapsed state ──
const collapsed = ref(false);
const toggleCollapsed = () => { collapsed.value = !collapsed.value; };

// ── Auto-dismiss: track recently completed models ──
const recentlyCompleted = ref<Set<string>>(new Set());
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Watch for models transitioning to "ready" and auto-dismiss after 4s
watch(modelsList, (models) => {
  for (const model of models) {
    const id = model.modelId ?? '';
    if (model.isReady && !recentlyCompleted.value.has(id) && !dismissTimers.has(id)) {
      recentlyCompleted.value.add(id);
      dismissTimers.set(id, setTimeout(() => {
        recentlyCompleted.value.delete(id);
        dismissTimers.delete(id);
      }, 4000));
    }
  }
}, { deep: true });

onUnmounted(() => {
  for (const timer of dismissTimers.values()) clearTimeout(timer);
  dismissTimers.clear();
});

// ── Visible models: downloading, loading, or recently completed ──
const visibleModels = computed(() =>
  modelsList.value.filter(model => {
    if (model.isDownloading || model.isLoading) return true;
    if (model.isReady && recentlyCompleted.value.has(model.modelId ?? '')) return true;
    return false;
  })
);

// Only show the panel when there's something to show
const showPanel = computed(() => visibleModels.value.length > 0);

const activeDownloadsCount = computed(() =>
  visibleModels.value.filter(m => m.isDownloading).length
);

// ── Friendly model names ──
const FRIENDLY_NAMES: Record<string, string> = {
  'onnx-community/gemma-4-E2B-it-ONNX': 'Gemma 4 (Generative AI)',
  'onnx-community/gemma-3-E2B-it-ONNX': 'Gemma 3 (Generative AI)',
  'Xenova/speecht5_tts': 'SpeechT5 (Text-to-Speech)',
  'Xenova/whisper-tiny': 'Whisper Tiny (Speech-to-Text)',
  'Xenova/whisper-small': 'Whisper Small (Speech-to-Text)',
  'Xenova/distilbart-cnn-6-6': 'DistilBART (Summarization)',
  'chandra/TexTeller-ONNX': 'TexTeller (Math OCR)',
  'Xenova/nougat-small': 'Nougat Small (Document OCR)',
};

function getFriendlyName(modelId?: string): string {
  if (!modelId) return 'Unknown Model';
  // Check known names first
  if (FRIENDLY_NAMES[modelId]) return FRIENDLY_NAMES[modelId];
  // Fall back to extracting just the model name from "org/model-name"
  const parts = modelId.split('/');
  const name = parts[parts.length - 1];
  // Clean up common suffixes and convert dashes/underscores
  return name
    .replace(/-ONNX$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// ── Format bytes ──
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const val = bytes / Math.pow(k, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

// ── Model status label ──
function getStatusLabel(model: { isDownloading: boolean; isLoading: boolean; isReady?: boolean; progress: number }) {
  if (model.isDownloading) return 'Downloading';
  if (model.isLoading) return 'Preparing…';
  if (model.isReady) return 'Ready';
  return 'Idle';
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="transform translate-y-full opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-full opacity-0">
    <div
      v-if="showPanel"
      id="ai-download-panel"
      class="ai-dl-panel fixed bottom-0 right-4 w-80 max-sm:left-4 max-sm:right-4 max-sm:w-auto z-[999] rounded-t-xl overflow-hidden"
    >
      <!-- Header -->
      <header
        class="ai-dl-header flex items-center justify-between cursor-pointer px-4 h-10 select-none"
        tabindex="0"
        @click="toggleCollapsed"
        aria-label="AI Model Download Status"
      >
        <div class="flex items-center gap-2">
          <!-- Animated cloud download icon -->
          <div class="ai-dl-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path d="M5.5 16a3.5 3.5 0 0 1-.369-6.98 4 4 0 1 1 7.753-1.977A3.5 3.5 0 0 1 14.5 16h-9Z" />
              <path fill-rule="evenodd" d="M10 2.75a.75.75 0 0 1 .75.75v5.59l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V3.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
            </svg>
          </div>
          <span class="text-xs font-semibold tracking-wide text-white/90">
            AI Models
            <span v-if="activeDownloadsCount > 0" class="text-white/60 font-normal ml-1">
              ({{ activeDownloadsCount }} downloading)
            </span>
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
          class="w-3.5 h-3.5 text-white/50 transition-transform duration-200"
          :class="{ 'rotate-180': collapsed }"
        >
          <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
        </svg>
      </header>

      <!-- Body -->
      <div v-show="!collapsed" class="ai-dl-body px-4 pb-3 pt-1 space-y-2.5 max-h-60 overflow-y-auto">
        <div
          v-for="model in visibleModels"
          :key="model.modelId"
          class="ai-dl-item rounded-lg p-2.5 space-y-1.5"
        >
          <!-- Model name + status -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-white/90 truncate" :title="model.modelId">
              {{ getFriendlyName(model.modelId) }}
            </span>
            <span
              class="text-[10px] font-semibold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded-full"
              :class="{
                'ai-dl-badge-downloading': model.isDownloading,
                'ai-dl-badge-loading': model.isLoading && !model.isDownloading,
                'ai-dl-badge-ready': model.isReady && !model.isDownloading && !model.isLoading,
              }"
            >
              {{ getStatusLabel(model) }}
            </span>
          </div>

          <!-- Progress bar (for downloading) -->
          <div v-if="model.isDownloading" class="space-y-1">
            <div class="ai-dl-progress-track">
              <div class="ai-dl-progress-fill" :style="{ width: `${model.progress}%` }" />
            </div>
            <div class="flex justify-between text-[10px] text-white/50">
              <span>{{ formatBytes(model.loaded) }} / {{ formatBytes(model.total) }}</span>
              <span>{{ Math.round(model.progress) }}%</span>
            </div>
          </div>

          <!-- Model size (when ready or loading) -->
          <div v-else-if="model.total > 0" class="text-[10px] text-white/45">
            Model size: {{ formatBytes(model.total) }}
          </div>

          <!-- Loading shimmer (post-download, preparing model) -->
          <div v-if="model.isLoading && !model.isDownloading" class="ai-dl-shimmer rounded-full h-1" />
        </div>
      </div>
    </div>
  </Transition>
</template>


<style scoped>
.ai-dl-panel {
  background: rgba(15, 15, 20, 0.92);
  backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: none;
  box-shadow:
    0 -4px 24px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

.ai-dl-header {
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ai-dl-icon-wrap {
  color: #60a5fa;
  animation: ai-icon-pulse 2s ease-in-out infinite;
}

@keyframes ai-icon-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.ai-dl-body {
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.ai-dl-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* Badges */
.ai-dl-badge-downloading {
  background: rgba(96, 165, 250, 0.15);
  color: #93bbfd;
}

.ai-dl-badge-loading {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  animation: ai-badge-blink 1.4s ease-in-out infinite;
}

.ai-dl-badge-ready {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

@keyframes ai-badge-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Progress bar */
.ai-dl-progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
}

.ai-dl-progress-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd);
  transition: width 0.3s ease;
  position: relative;
}

.ai-dl-progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.3) 50%,
    transparent 100%
  );
  animation: ai-progress-shine 1.5s ease-in-out infinite;
}

@keyframes ai-progress-shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Shimmer for loading state */
.ai-dl-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 0%,
    rgba(255,255,255,0.12) 50%,
    rgba(255,255,255,0.04) 100%
  );
  background-size: 200% 100%;
  animation: ai-shimmer 1.5s ease-in-out infinite;
}

@keyframes ai-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .ai-dl-panel,
  .ai-dl-panel *,
  .ai-dl-progress-fill,
  .ai-dl-progress-fill::after,
  .ai-dl-shimmer,
  .ai-dl-icon-wrap,
  .ai-dl-badge-loading {
    animation: none !important;
    transition: none !important;
  }
}
</style>