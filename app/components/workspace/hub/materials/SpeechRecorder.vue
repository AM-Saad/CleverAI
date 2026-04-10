<template>
  <div
    class="speech-recorder flex flex-col items-center gap-4 p-5 rounded-[var(--radius-2xl)] bg-white shadow-sm transition-all">
    <div class="w-full flex justify-between items-center mb-1">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-microphone" class="w-5 h-5 text-content-secondary" />
        <h3 class="text-sm font-semibold text-content-on-surface-strong">Speech to Text</h3>
      </div>
      <span v-if="isRecording" class="text-xs font-medium text-rose-500 animate-pulse flex items-center gap-1.5">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
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
      <UButton v-if="!isRecording" color="error" variant="soft" icon="i-heroicons-microphone"
        class="flex-1 justify-center transition-all hover:scale-[1.02] shadow-sm hover:shadow active:scale-[0.98]"
        @click="startRecording" size="md">
        Record Voice
      </UButton>
      <UButton v-else color="error" variant="solid" icon="i-heroicons-stop-circle"
        class="flex-1 justify-center transition-all shadow-md active:scale-[0.98]" @click="stopRecording" size="md">
        Stop Recording
      </UButton>

      <div class="relative flex-1 flex flex-col">
        <UButton color="neutral" variant="soft" icon="i-heroicons-arrow-up-tray"
          class="flex-1 justify-center transition-all hover:scale-[1.02] shadow-sm hover:shadow active:scale-[0.98]"
          :disabled="isRecording" @click="() => fileInput?.click()" size="md">
          Upload Audio
        </UButton>
        <input type="file" ref="fileInput" accept="audio/*" class="hidden" @change="handleFileUpload" />
      </div>
    </div>

    <!-- Step 2: Audio staged — confirm transcription -->
    <div v-if="stagedAudio" class="w-full space-y-3">
      <div class="bg-surface-subtle p-3 rounded-[var(--radius-xl)] flex items-center gap-3">
        <icon name="i-lucide-audio-lines" class="w-5 h-5 text-rose-500 shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-content-on-surface truncate">{{ stagedAudio.label }}</p>
          <p class="text-xs text-content-secondary">Ready to transcribe</p>
        </div>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-x-mark" @click="clearStaged"
          aria-label="Remove" />
      </div>

      <!-- Title input -->
      <UInput v-model="materialTitle" placeholder="Material title (optional)" :ui="{ root: 'w-full' }" size="sm" />

      <div class="flex gap-2 justify-end">
        <UButton variant="ghost" size="sm" @click="clearStaged">Cancel</UButton>
        <UButton color="primary" size="sm" icon="i-heroicons-sparkles" @click="confirmTranscribe">
          Transcribe
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  (e: 'confirmed', audioBlob: Blob, title: string): void;
  (e: 'error', error: Error): void;
}>();

const isRecording = ref(false);
const errorMsg = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const materialTitle = ref('');

// Staged audio: recorded or uploaded, waiting for user confirmation
const stagedAudio = ref<{ blob: Blob; label: string } | null>(null);

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

// ── Recording ──
async function startRecording() {
  errorMsg.value = null;
  audioChunks = [];

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const types = [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/webm',
      ''
    ];

    let mimeType = '';
    for (const type of types) {
      if (type === '' || MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());

      if (audioChunks.length === 0) {
        errorMsg.value = "No audio recorded.";
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
      stagedAudio.value = { blob: audioBlob, label: 'Voice Recording' };
    };

    mediaRecorder.start();
    isRecording.value = true;
  } catch (err: any) {
    console.error('Failed to start recording:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg.value = 'Microphone permission denied. Please allow microphone access to record.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg.value = 'No microphone found on this device.';
    } else {
      errorMsg.value = `Could not start recording: ${err.message}`;
    }
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording.value) {
    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording.value = false;
  }
}

// ── File upload ──
function handleFileUpload(event: Event) {
  errorMsg.value = null;
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
  errorMsg.value = null;
}
</script>
