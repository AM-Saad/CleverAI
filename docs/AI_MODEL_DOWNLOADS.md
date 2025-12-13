# AI Model Download Management

## Overview

The AI Model Download system provides a centralized, app-level store for managing downloads of Transformers.js models with progress tracking, retry logic, and failure handling. A global toast notification shows download progress and errors automatically.

## Architecture

### Components

1. **Store**: `app/stores/modelDownload.ts` - Pinia store managing download state
2. **Composables**: 
   - `app/composables/ai/useAIModel.ts` - Generic model loading
   - `app/composables/ai/useTextSummarization.ts` - Text processing models (summarization, Q&A, generation)
3. **UI Components**:
   - `app/components/ai/ModelDownloadProgress.vue` - Full download list with details
   - `app/components/ai/ModelDownloadToast.vue` - Global toast notifications (shows errors & progress)
4. **Demo Page**: `app/pages/demo/ai-models.vue` - Complete usage examples

## Quick Start

### 1. Global Toast Setup (Required for Visibility)

Add to your main layout (`app.vue`) to see download progress and errors:

```vue
<template>
  <div>
    <NuxtPage />
    
    <!-- AI Model Download Toast - Shows progress & errors -->
    <ClientOnly>
      <ai-model-download-toast />
    </ClientOnly>
  </div>
</template>
```

**This is why you weren't seeing errors!** The toast component displays:
- Download progress with percentage
- Error messages with retry button
- Success notifications
- Fixed position (bottom-right corner)

### 2. Text Summarization

```vue
<script setup lang="ts">
import { useTextSummarization } from '~/composables/ai/useTextSummarization';

const { summarize, isSummarizing, isDownloading, progress } = useTextSummarization();

async function handleSummarize(text: string) {
  try {
    const summary = await summarize(text, {
      maxLength: 130,
      minLength: 30,
    });
    console.log('Summary:', summary);
  } catch (error) {
    console.error('Summarization failed:', error);
  }
}
</script>

<template>
  <div>
    <button @click="handleSummarize(longText)" :disabled="isSummarizing || isDownloading">
      {{ isDownloading ? `Downloading (${progress}%)` : isSummarizing ? 'Summarizing...' : 'Summarize' }}
    </button>
  </div>
</template>
```

### 3. Generic Model Usage

```vue
<script setup lang="ts">
import { useAIModel } from '~/composables/ai/useAIModel';

const { model, isLoading, progress, error, retry } = useAIModel({
  task: 'text-to-speech',
  modelId: 'ylacombe/mms-guj-finetuned-monospeaker',
  options: { quantized: false },
  immediate: true, // Auto-load on mount
});

// Use the model when loaded
watchEffect(async () => {
  if (model.value) {
    const output = await model.value('Hello world');
    console.log(output);
  }
});
</script>
```

### 2. Text-to-Speech Helper

```vue
<script setup lang="ts">
import { useTextToSpeech } from '~/composables/ai/useAIModel';

const { synthesize, isReady, progress } = useTextToSpeech({
  modelId: 'Xenova/speecht5_tts',
  quantized: false,
  immediate: true,
});

async function handleSpeak() {
  const audio = await synthesize('Hello world');
  // Process audio output
}
</script>
```

### 3. Direct Store Usage

```vue
<script setup lang="ts">
import { useModelDownloadStore } from '~/stores/modelDownload';

const modelStore = useModelDownloadStore();

async function loadModel() {
  try {
    const model = await modelStore.downloadModel({
      task: 'text-to-speech',
      modelId: 'ylacombe/mms-guj-finetuned-monospeaker',
      options: { quantized: false },
    });
    
    // Use model
    const output = await model('Hello world');
  } catch (error) {
    console.error('Download failed:', error);
  }
}

// Check download status
const progress = modelStore.getDownloadProgress('ylacombe/mms-guj-finetuned-monospeaker');
console.log(`Progress: ${progress?.progress}%`);

// Retry failed download
await modelStore.retryDownload('ylacombe/mms-guj-finetuned-monospeaker');

// Unload model from memory
modelStore.unloadModel('ylacombe/mms-guj-finetuned-monospeaker');
</script>
```

## UI Components

### Global Toast Notifications

Add to your app layout for non-intrusive notifications:

```vue
<!-- app.vue or layouts/default.vue -->
<template>
  <div>
    <NuxtPage />
    <ai-model-download-toast />
  </div>
</template>
```

Features:
- Shows active downloads with overall progress
- Expandable to show individual model progress
- Auto-shows errors with retry option
- Success notifications (auto-dismiss after 3s)
- Fixed position (bottom-right corner)

### Detailed Progress Component

For dedicated download management pages:

```vue
<template>
  <ai-model-download-progress :show-completed="true" />
</template>
```

Features:
- Lists all active downloads with individual progress bars
- Failed downloads with retry buttons
- Completed downloads (collapsible)
- Byte-level progress tracking
- Relative time stamps

## Store API

### State

```typescript
interface ModelDownloadProgress {
  modelId: string;
  task: PipelineType;
  status: 'idle' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  bytesDownloaded?: number;
  totalBytes?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}
```

### Actions

- **`downloadModel(config)`** - Download and load a model
- **`retryDownload(modelId)`** - Retry a failed download
- **`getModel(config)`** - Get cached model or download if needed
- **`unloadModel(modelId)`** - Remove model from memory
- **`clearDownload(modelId)`** - Clear download record
- **`clearAllDownloads()`** - Clear all download records
- **`clearFailedDownloads()`** - Clear only failed downloads
- **`reset()`** - Unload all models and clear all records

### Getters

- **`getDownloadProgress(modelId)`** - Get progress for specific model
- **`isDownloading(modelId)`** - Check if model is downloading
- **`isModelLoaded(modelId)`** - Check if model is loaded
- **`activeDownloads`** - Array of active downloads
- **`failedDownloads`** - Array of failed downloads
- **`completedDownloads`** - Array of completed downloads
- **`overallProgress`** - Average progress of all active downloads
- **`hasActiveDownloads`** - Boolean indicating any active downloads

## Features

### ✅ Progress Tracking

- Real-time progress updates (0-100%)
- Byte-level tracking (downloaded/total)
- Overall progress across multiple downloads
- Duration tracking (started/completed timestamps)

### ✅ Error Handling

- Automatic error capture
- Configurable retry limits (default: 3)
- Error messages preserved in state
- Manual retry capability

### ✅ Multi-Model Support

- Download multiple models simultaneously
- Independent progress tracking per model
- Shared cache prevents duplicate downloads
- Efficient memory management

### ✅ Caching

- Models cached after first download
- Instant access to previously loaded models
- Memory cleanup when unloading
- Persistent across component lifecycle

### ✅ UI Flexibility

- Toast notifications (non-intrusive)
- Detailed progress component
- Custom UI via store access
- Reactive state updates

## Advanced Usage

### Multiple Models

```typescript
const modelStore = useModelDownloadStore();

// Download multiple models
await Promise.all([
  modelStore.downloadModel({
    task: 'text-to-speech',
    modelId: 'Xenova/speecht5_tts',
  }),
  modelStore.downloadModel({
    task: 'automatic-speech-recognition',
    modelId: 'Xenova/whisper-tiny',
  }),
  modelStore.downloadModel({
    task: 'text-classification',
    modelId: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  }),
]);
```

### Custom Progress UI

```vue
<script setup lang="ts">
const modelStore = useModelDownloadStore();

const activeDownloads = computed(() => modelStore.activeDownloads);
const overallProgress = computed(() => modelStore.overallProgress);
</script>

<template>
  <div v-for="download in activeDownloads" :key="download.modelId">
    <h4>{{ download.modelId }}</h4>
    <div class="progress-bar" :style="{ width: `${download.progress}%` }" />
    <p>{{ download.progress }}%</p>
  </div>
  
  <div>Overall: {{ overallProgress }}%</div>
</template>
```

### Conditional Loading

```typescript
const { model, loadModel } = useAIModel({
  task: 'text-to-speech',
  modelId: 'Xenova/speecht5_tts',
  immediate: false, // Don't auto-load
});

// Load only when needed
async function onUserAction() {
  if (!model.value) {
    await loadModel();
  }
  
  const result = await model.value('Hello');
}
```

## Best Practices

1. **Use Composables**: Prefer `useAIModel` or `useTextToSpeech` over direct store access
2. **Add Toast Component**: Include `<ai-model-download-toast />` in your app layout
3. **Handle Errors**: Always handle errors from `downloadModel` or `synthesize`
4. **Retry Logic**: Use built-in retry functionality instead of manual retries
5. **Memory Management**: Unload unused models to free memory
6. **Lazy Loading**: Set `immediate: false` for models that aren't always needed
7. **Cache Awareness**: Check `isModelLoaded` before triggering downloads

## Example: Complete Integration

```vue
<!-- app.vue -->
<template>
  <div>
    <NuxtPage />
    <ai-model-download-toast />
  </div>
</template>

<!-- pages/speech.vue -->
<template>
  <div>
    <textarea v-model="text" />
    <button @click="speak" :disabled="!isReady">
      {{ isReady ? 'Speak' : `Loading... ${progress}%` }}
    </button>
    
    <button v-if="error" @click="retry">Retry</button>
  </div>
</template>

<script setup lang="ts">
const text = ref('Hello world');

const { synthesize, isReady, progress, error, retry } = useTextToSpeech({
  modelId: 'Xenova/speecht5_tts',
  immediate: true,
});

async function speak() {
  try {
    const audio = await synthesize(text.value);
    // Play audio
  } catch (err) {
    console.error('Synthesis failed:', err);
  }
}
</script>
```

## Troubleshooting

### Model won't download
- Check network connection
- Verify model ID is correct
- Check browser console for errors
- Try manual retry via store

### High memory usage
- Unload models when not needed: `modelStore.unloadModel(modelId)`
- Use quantized models: `options: { quantized: true }`
- Limit concurrent downloads

### Progress not updating
- Ensure component is reactive (using `computed` or `ref`)
- Check if progress callback is working (console logs)
- Verify store is properly initialized

## Demo

Visit `/demo/ai-models` to see a complete working example with:
- Text-to-speech synthesis
- Multiple model downloads
- Progress tracking
- Error handling and retry
- Statistics dashboard
