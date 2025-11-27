# LLM Gateway Quick Start Guide

**Get up and running in 5 minutes** ⚡

---

## Step 1: Environment Setup

Add to `.env`:
```bash
ENABLE_LLM_GATEWAY=true
```

Existing keys should already be set:
```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
REDIS_URL=redis://...  # Optional but recommended
```

---

## Step 2: Database Migration

```bash
yarn db:sync
```

This creates:
- `llm_model_registry` collection
- `llm_gateway_logs` collection

---

## Step 3: Verify Setup

Start dev server:
```bash
yarn dev
```

The model registry will auto-seed on first gateway request with 5 default models:
1. Gemini Flash Lite 8B (cheapest)
2. GPT-4o-mini
3. Gemini 2.0 Flash
4. GPT-3.5 Turbo
5. GPT-4o (most expensive)

---

## Step 4: Test the Gateway

### Via curl:
```bash
curl -X POST http://localhost:3000/api/llm.gateway \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{
    "task": "flashcards",
    "text": "The mitochondria is the powerhouse of the cell."
  }'
```

### Via Frontend Composable:
```vue
<script setup>
import { useGatewayGenerate } from '~/composables/folders/useGatewayGenerate'

const { generateFlashcards, isGenerating, error } = useGatewayGenerate()

async function handleGenerate() {
  try {
    const result = await generateFlashcards('Your study material here...', {
      folderId: route.params.id,
      save: true
    })
    
    console.log('Generated:', result.flashcards)
    console.log('Model used:', result.selectedModelId)
    console.log('Latency:', result.latencyMs + 'ms')
    console.log('Cached:', result.cached)
  } catch (err) {
    console.error('Generation failed:', err)
  }
}
</script>

<template>
  <button @click="handleGenerate" :disabled="isGenerating">
    {{ isGenerating ? 'Generating...' : 'Generate Flashcards' }}
  </button>
  <div v-if="error" class="error">{{ error }}</div>
</template>
```

---

## Step 5: Monitor Performance

### Check which models are being used:
```javascript
// In MongoDB shell or Compass
db.llm_gateway_logs.aggregate([
  { $group: {
      _id: "$selectedModelId",
      count: { $sum: 1 },
      avgLatency: { $avg: "$latencyMs" }
    }
  },
  { $sort: { count: -1 } }
])
```

### Check cache hit rate:
```javascript
db.llm_gateway_logs.aggregate([
  { $group: {
      _id: null,
      total: { $sum: 1 },
      cacheHits: { $sum: { $cond: ["$cacheHit", 1, 0] } }
    }
  }
])
```

---

## Common Use Cases

### 1. Basic Generation (Let Gateway Choose)
```typescript
const { generate } = useGatewayGenerate()

const result = await generate({
  task: 'flashcards',
  text: studyMaterial.value
})
```

### 2. Save to Folder
```typescript
const result = await generate({
  task: 'quiz',
  text: studyMaterial.value,
  folderId: currentFolder.value.id,
  save: true,
  replace: false  // Don't delete existing content
})
```

### 3. Override Model Selection
```typescript
// Force use of specific model (e.g., for premium users)
const result = await generate({
  task: 'flashcards',
  text: studyMaterial.value,
  preferredModelId: 'gpt-4o'  // Override routing
})
```

### 4. Require Specific Capability
```typescript
// For multimodal content (images)
const result = await generate({
  task: 'flashcards',
  text: imageDescription.value,
  requiredCapability: 'multimodal'  // Only models with this capability
})
```

---

## Admin Controls

### List All Models
```bash
curl http://localhost:3000/api/admin/llm-models \
  -H "Cookie: next-auth.session-token=ADMIN_SESSION"
```

### Disable a Model
```bash
curl -X POST http://localhost:3000/api/admin/llm-models/gemini-flash-8b/toggle \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=ADMIN_SESSION" \
  -d '{ "enabled": false }'
```

### Change Model Priority
```bash
# Lower priority = preferred (1 is highest)
curl -X PATCH http://localhost:3000/api/admin/llm-models/gpt-4o-mini/priority \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=ADMIN_SESSION" \
  -d '{ "priority": 1 }'
```

---

## Feature Flag Toggle

**Enable Gateway**:
```bash
ENABLE_LLM_GATEWAY=true
```

**Disable Gateway** (use legacy endpoint):
```bash
ENABLE_LLM_GATEWAY=false
```

**Check in code**:
```typescript
const config = useRuntimeConfig()

if (config.public.enableLlmGateway) {
  // Use gateway
  await useGatewayGenerate().generate(...)
} else {
  // Use legacy
  await useLegacyGenerate().generate(...)
}
```

---

## Expected Cost Savings

**Before Gateway** (100% GPT-4o):
- 1,000 requests × 2,000 tokens avg = $0.50

**After Gateway** (smart routing):
- 70% Gemini Flash Lite: $0.02
- 20% GPT-4o-mini: $0.03
- 10% GPT-4o: $0.05
- **Total: $0.10** (80% savings)

**With 30% Cache Hit Rate**:
- **Total: $0.07** (86% savings)

---

## Debugging Tips

### Gateway not working?
1. Check `ENABLE_LLM_GATEWAY=true` in `.env`
2. Restart dev server
3. Verify `yarn db:sync` was run
4. Check browser console for errors

### Models not being selected?
1. Check model registry: `db.llm_model_registry.find()`
2. Verify `enabled: true` on models
3. Check `healthStatus` is not 'down'
4. Review routing logs in terminal

### High latency?
1. Check Redis connection (cache misses = slow)
2. Review model latency: `db.llm_model_registry.find({}, {modelId: 1, avgLatencyMs: 1})`
3. Consider adjusting `latencyBudgetMs` for models

### Unexpected model chosen?
1. Check priority values (lower = preferred)
2. Review scoring logs in terminal
3. Test with `preferredModelId` to override
4. Check token counts (large requests favor cheap models)

---

## Key Files to Know

**Backend**:
- `server/api/llm.gateway.post.ts` - Main endpoint
- `server/utils/llm/routing.ts` - Selection algorithm
- `server/utils/llm/modelRegistry.ts` - Model management

**Frontend**:
- `app/composables/folders/useGatewayGenerate.ts` - Composable
- `app/services/GatewayService.ts` - API client

**Documentation**:
- `docs/architecture/LLM_GATEWAY_IMPLEMENTATION.md` - Full implementation
- `docs/architecture/llm-gateway-routing.md` - Routing algorithm
- `docs/architecture/llm-gateway-penalty-system.md` - Penalty mechanics

---

## Need Help?

1. Check the comprehensive docs: `docs/architecture/LLM_GATEWAY_IMPLEMENTATION.md`
2. Review penalty system: `docs/architecture/llm-gateway-penalty-system.md`
3. Inspect database: `yarn db:studio`
4. Enable debug logs: Add `console.log` in routing.ts

**Common Questions**:
- Q: *Why isn't the cheapest model always selected?*
- A: Routing balances cost, latency, priority, and health. Slow models get penalties.

- Q: *Can I force a specific model?*
- A: Yes, use `preferredModelId` in the request.

- Q: *How often are latency averages updated?*
- A: Every request updates the rolling average (80% old, 20% new).

- Q: *Do penalties permanently disable models?*
- A: No, penalties are soft. Models with 10-30% traffic auto-recover when fast again.

---

**You're all set!** 🎉

Start using the gateway in your components and watch the cost savings roll in.
