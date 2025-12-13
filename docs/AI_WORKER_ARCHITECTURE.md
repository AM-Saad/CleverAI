# AI Worker Architecture

## Overview

The AI worker implementation moves heavy ML model inference to a dedicated Web Worker, keeping the UI responsive while processing. This follows the same architectural patterns as the service worker implementation.

**Key Design Decision**: The AI worker is built from TypeScript source (`sw-src/ai-worker.ts`) using the same esbuild pipeline as the service worker, ensuring type safety, consistency, and maintainability.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Main Thread (UI)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │ TiptapEditor.vue │────────>│ useTextSummarization()  │  │
│  └──────────────────┘         └──────────┬──────────────┘  │
│                                           │                  │
│                                           │ postMessage      │
│                                           ▼                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ai-worker.client.ts (Plugin)                       │    │
│  │  - Registers worker                                 │    │
│  │  - Provides $aiWorker globally                      │    │
│  │  - Dispatches 'ai-worker-message' events           │    │
│  └──────────────────────┬─────────────────────────────┘    │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │ postMessage
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Worker Thread                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  public/ai-worker.js                                │    │
│  │  - Manages model lifecycle (singleton pattern)     │    │
│  │  - Runs Transformers.js inference                  │    │
│  │  - Reports progress & results back                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ModelPipeline (Static Class)                      │    │
│  │  - getInstance() - loads model once                │    │
│  │  - unload() - releases memory                      │    │
│  │  - instances Map - caches loaded models            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

### Core Files

```
sw-src/
  └── ai-worker.ts            # TypeScript source (built to public/ai-worker.js)

shared/types/
  ├── ai-messages.ts          # Typed message contracts
  
app/
  ├── plugins/
  │   └── ai-worker.client.ts # Worker registration & lifecycle
  │
  └── composables/ai/
      └── useTextSummarization.ts  # Worker communication layer

app/utils/constants/
  └── pwa.ts                  # AI_WORKER_MESSAGE_TYPES

scripts/
  └── check-ai-worker.cjs     # Build validation script

public/
  └── ai-worker.js            # Built worker script (model inference)
```

## Message Flow

### 1. Model Loading

```typescript
// User clicks "Summarize"
TiptapEditor.vue
  └─> useTextSummarization.summarize()
        └─> loadModel() if not ready
              └─> $aiWorker.postMessage({ type: LOAD_MODEL, data: {...} })
                    └─> ai-worker.js receives message
                          └─> ModelPipeline.getInstance()
                                └─> pipeline() from Transformers.js
                                      └─> Progress callbacks
                                            └─> postMessage({ type: MODEL_LOAD_PROGRESS })
                                                  └─> Event: 'ai-worker-message'
                                                        └─> useTextSummarization updates progress ref
                                                              └─> ModelDownloadToast shows progress
```

### 2. Inference

```typescript
// Model loaded, run summarization
useTextSummarization.summarize(text)
  └─> $aiWorker.postMessage({ 
        type: RUN_INFERENCE, 
        data: { requestId, modelId, task, input, options } 
      })
        └─> ai-worker.js receives message
              └─> model(input, options)  // Runs in worker thread
                    └─> postMessage({ type: INFERENCE_COMPLETE, result })
                          └─> Event: 'ai-worker-message'
                                └─> Promise resolves with result
                                      └─> currentSummary.value = result
                                            └─> watch() triggers
                                                  └─> TiptapEditor inserts summary
```

## Key Design Patterns

### 1. Singleton Pattern (Model Management)

```javascript
// ai-worker.js
class ModelPipeline {
  static instances = new Map();
  
  static async getInstance(task, modelId, options, progressCallback) {
    const key = `${task}:${modelId}`;
    if (this.instances.has(key)) return this.instances.get(key);
    
    const model = await pipeline(task, modelId, { ...options, progress_callback });
    this.instances.set(key, model);
    return model;
  }
}
```

**Benefits:**
- Model loaded once per task:modelId combo
- Automatic caching across requests
- Memory efficient

### 2. Request/Response Pattern

```typescript
// Unique request IDs prevent message collision
const requestId = `summarization-${Date.now()}-${Math.random()}`;

// Send request
$aiWorker.postMessage({ type: RUN_INFERENCE, data: { requestId, ... } });

// Wait for matching response
const handler = (event) => {
  if (message.data.requestId === requestId) {
    // Handle response
  }
};
window.addEventListener('ai-worker-message', handler);
```

**Benefits:**
- Multiple concurrent requests supported
- No race conditions
- Clean promise-based API

### 3. Event-Driven Communication

```typescript
// Plugin dispatches custom events
window.dispatchEvent(
  new CustomEvent('ai-worker-message', { detail: message })
);

// Composables listen for events
window.addEventListener('ai-worker-message', handleWorkerMessage);
```

**Benefits:**
- Decoupled components
- Multiple listeners possible
- Follows existing SW pattern

## Build Process

### Development
```bash
yarn ai-worker:build  # Compiles sw-src/ai-worker.ts → public/ai-worker.js
yarn dev              # Automatically builds AI worker before starting dev server
```

### Production
```bash
yarn build:inject     # Builds SW + AI worker, validates both, then builds Nuxt
```

### Build Scripts
- **`ai-worker:build`**: esbuild compiles TypeScript source to IIFE bundle
- **`ai-worker:check`**: Validates built worker contains essential code
- **`prebuild`**: Runs both SW and AI worker builds + validation
- **`build:inject`**: Full production build with Workbox manifest injection

## Configuration

### Transformers.js Setup

```typescript
// sw-src/ai-worker.ts
env.allowLocalModels = false;      // Force HuggingFace CDN
env.useBrowserCache = true;        // Cache models in browser
env.backends.onnx.wasm.numThreads = 1;  // Single thread for stability
env.allowRemoteModels = true;      // Enable remote loading
env.cacheDir = '.transformers-cache';   // Cache directory name
```

### Model Configuration

```typescript
// Default summarization model
const modelId = "Xenova/distilbart-cnn-6-6";

// Options
{
  quantized: true,  // Use 8-bit quantized model (smaller, faster)
  device: "wasm",   // WebAssembly backend (universal support)
}
```

## Usage Example

### In Components

```vue
<script setup>
const { 
  currentSummary, 
  startSummarization, 
  isSummarizing,
  progress 
} = useTextSummarization();

// Watch for summary completion
watch(currentSummary, (summary) => {
  if (summary) {
    console.log('Summary ready:', summary);
    // Insert into editor, show notification, etc.
  }
});

// Trigger non-blocking summarization
function handleSummarize() {
  const text = getSelectedText();
  startSummarization(text);
  // UI remains responsive - user can continue working
}
</script>
```

### Direct API

```typescript
// Await result (blocking)
const summary = await summarize('Long text here...');

// Fire-and-forget (non-blocking)
startSummarization('Long text here...');
// Watch currentSummary for completion
```

## Performance Characteristics

### Model Loading

- **First time:** 2-6 minutes (downloads ~200-400MB ONNX files)
- **Subsequent times:** Instant (loaded from browser cache)
- **Memory:** ~500MB - 1GB depending on model

### Inference

- **Summarization:** 5-30 seconds depending on text length
- **Non-blocking:** UI remains fully responsive
- **Memory:** Runs in isolated worker thread

### Caching

- **Location:** Browser Cache Storage API
- **Persistence:** Survives page reloads
- **Size:** Model files are ~200-400MB
- **Strategy:** Cache-first (never re-download unless cache cleared)

## Error Handling

### Model Load Errors

```typescript
// Automatic error propagation
const { error } = useTextSummarization();

watch(error, (err) => {
  if (err) {
    toast.add({
      title: 'Model Load Failed',
      description: err.message,
      color: 'error'
    });
  }
});
```

### Inference Errors

```typescript
try {
  const summary = await summarize(text);
} catch (err) {
  console.error('Summarization failed:', err);
  // Show error to user
}
```

### Timeout Protection

- **Model loading:** 5 minute timeout
- **Inference:** 2 minute timeout
- **Automatic cleanup:** Event listeners removed on timeout

## Comparison with Previous Implementation

### Before (Main Thread)

```typescript
// ❌ Blocked UI during inference
const model = await pipeline('summarization', modelId);
const result = await model(text);  // UI freezes here (5-30s)
```

**Problems:**
- UI completely frozen during inference
- Browser "page unresponsive" warnings
- Poor user experience
- No progress visibility

### After (Web Worker)

```typescript
// ✅ Non-blocking inference
startSummarization(text);
// UI remains responsive
// User can continue editing, navigating, etc.
watch(currentSummary, (summary) => {
  // Handle result when ready
});
```

**Benefits:**
- UI always responsive
- Progress reporting
- Multiple concurrent operations
- Better user experience

## Future Enhancements

### Potential Additions

1. **Streaming Output**
   - Real-time summary generation
   - Character-by-character display
   - Use `TextStreamer` from Transformers.js

2. **Model Warm-up**
   - Pre-load models on app start
   - Reduce first-use latency

3. **Additional Tasks**
   - Question answering
   - Text generation
   - Translation
   - All follow same worker pattern

4. **GPU Acceleration**
   - WebGPU backend when available
   - Significant performance boost
   - Fallback to WASM for compatibility

## Debugging

### Enable Debug Mode

```typescript
// In browser console
$aiWorker.postMessage({ 
  type: 'SET_DEBUG', 
  value: true 
});
```

### Monitor Messages

```typescript
// Listen to all worker messages
window.addEventListener('ai-worker-message', (event) => {
  console.log('Worker message:', event.detail);
});
```

### Check Worker Status

```typescript
// Access via Nuxt plugin
const { $aiWorker } = useNuxtApp();
console.log('Worker ready:', $aiWorker.isReady);
```

## Troubleshooting

## Build Pipeline Comparison

### Service Worker
```
sw-src/index.ts
  ↓ (esbuild)
public/sw.js
  ↓ (check-sw-placeholder.cjs validates)
  ↓ (Workbox injectManifest)
.output/public/sw.js (with precache manifest)
```

### AI Worker
```
sw-src/ai-worker.ts
  ↓ (esbuild)
public/ai-worker.js
  ↓ (check-ai-worker.cjs validates)
.output/public/ai-worker.js (copied to output)
```

Both workers:
- Start as TypeScript source
- Compile via esbuild to IIFE format
- Get validated before builds
- Ship as separate bundles (no bundler conflicts)

## Related Files

- Service Worker: `sw-src/index.ts` → `public/sw.js`
- AI Worker: `sw-src/ai-worker.ts` → `public/ai-worker.js`
- SW Messages Plugin: `app/plugins/sw-messages.client.ts`
- AI Worker Plugin: `app/plugins/ai-worker.client.ts`
- SW Types: `shared/types/sw-messages.ts`
- AI Types: `shared/types/ai-messages.ts`
- PWA Constants: `app/utils/constants/pwa.ts`

The AI worker follows the exact same patterns as the service worker for consistency and maintainability.

1. Reduce max_length in options
2. Split long text into chunks
3. Check browser console for memory errors

### UI Still Freezes

1. Verify worker is actually running (check `$aiWorker.isReady`)
2. Check for any remaining main-thread model loading
3. Verify no accidental `await` in event handlers

## Related Files

- Service Worker: `sw-src/index.ts`
- SW Messages Plugin: `app/plugins/sw-messages.client.ts`
- SW Types: `shared/types/sw-messages.ts`
- PWA Constants: `app/utils/constants/pwa.ts`

The AI worker follows the exact same patterns as the service worker for consistency and maintainability.
