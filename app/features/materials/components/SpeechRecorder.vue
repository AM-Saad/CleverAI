<script setup lang="ts">
import { ref } from 'vue';
import { useAudioRecorder } from '~/composables/useAudioRecorder';

const emit = defineEmits<{
  (e: 'confirmed', audioBlob: Blob, title: string): void;
  (e: 'error', error: Error): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const materialTitle = ref('');

// Staged audio: recorded or uploaded, waiting for user confirmation
const stagedAudio = ref<{ blob: Blob; label: string } | null>(null);

const { isRecording, error: recordingError, startRecording, stopRecording } = useAudioRecorder({
  maxDuration: 0, // no limit for material recordings — user decides when to stop
  onRecorded(blob) {
    stagedAudio.value = { blob, label: 'Voice Recording' };
  },
});

const errorMsg = computed(() => recordingError.value);

// ── File upload ──
function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;
  if (fileInput.value) fileInput.value.value = '';

  stagedAudio.value = { blob: file, label: file.name };
}

// ── Confirmation → emit to parent ──
function confirmTranscribe() {
  if (!stagedAudio.value) return;
  const title = materialTitle.value.trim() || stagedAudio.value.label || 'Voice Recording';
  emit('confirmed', stagedAudio.value.blob, title);
}

function clearStaged() {
  stagedAudio.value = null;
  materialTitle.value = '';
}
</script>


<template>
  <ui-card class="speech-recorder  transition-all" variant="surface" size="sm">
    <template #header>
      <div class="flex items-center gap-2">
        <shared-icon name="mic" class="w-5 h-5" />
        Speech to Text
      </div>
    </template>
    <div class="w-full flex justify-between items-center mb-1">

      <span v-if="isRecording" class="text-xs font-medium text-error animate-pulse flex items-center gap-1.5">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-error/80 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
        </span>
        Recording
      </span>
      <span v-else class="text-xs font-medium text-content-disabled">
        Ready
      </span>
    </div>

    <!-- Error state -->
    <div v-show="errorMsg"
      class="w-full p-3 bg-error/10 text-error text-sm rounded-[var(--radius-xl)] flex items-start gap-2 border border-error/20">
      <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5 flex-shrink-0 mt-0.5" />
      <span>{{ errorMsg }}</span>
    </div>

    <!-- Step 1: Record / Upload buttons (only when no audio is staged) -->
    <div v-if="!stagedAudio" class="flex flex-col sm:flex-row items-stretch gap-3 w-full">
      <UiButton v-if="!isRecording" color="error" variant="soft" icon="i-heroicons-microphone"
        class="flex-1 justify-center transition-all active:scale-[0.98]" @click="startRecording" size="md">
        Record Voice
      </UiButton>
      <UiButton v-else color="error" variant="solid" icon="i-heroicons-stop-circle"
        class="flex-1 justify-center transition-all shadow-[var(--shadow-dropdown)] active:scale-[0.98]" @click="stopRecording" size="md">
        Stop Recording
      </UiButton>

      <div class="relative flex-1 flex flex-col">
        <UiButton color="neutral" variant="soft" icon="i-heroicons-arrow-up-tray"
          class="flex-1 justify-center transition-all active:scale-[0.98]" :disabled="isRecording"
          @click="() => fileInput?.click()" size="md">
          Upload Audio
        </UiButton>
        <input type="file" ref="fileInput" accept="audio/*" class="hidden" @change="handleFileUpload" />
      </div>
    </div>

    <!-- Step 2: Audio staged — confirm transcription -->
    <div v-if="stagedAudio" class="w-full space-y-3">
      <div class="bg-surface-subtle p-3 rounded-[var(--radius-xl)] flex items-center gap-3">
        <icon name="i-lucide-audio-lines" class="w-5 h-5 text-error shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-content-on-surface truncate">{{ stagedAudio.label }}</p>
          <p class="text-xs text-content-secondary">Ready to transcribe</p>
        </div>
        <UiButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-x-mark" @click="clearStaged"
          aria-label="Remove" />
      </div>

      <!-- Title input -->
      <UiInput v-model="materialTitle" placeholder="Material title (optional)" :ui="{ root: 'w-full' }" size="sm" />

      <div class="flex gap-2 justify-end">
        <UiButton variant="ghost" size="sm" @click="clearStaged">Cancel</UiButton>
        <UiButton color="primary" size="sm" icon="i-heroicons-sparkles" @click="confirmTranscribe">
          Transcribe
        </UiButton>
      </div>
    </div>
  </ui-card>
</template>
