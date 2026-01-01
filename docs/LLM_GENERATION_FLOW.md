# 🔄 LLM Generation Flow Analysis

## Complete End-to-End Trace: User Action → Flashcard/Quiz Creation

---

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Nuxt 3)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  GenerateButton.vue → useGenerateFromMaterial → GatewayService.ts          │
│         ↓                      ↓                       ↓                    │
│   [UI Trigger]         [State Machine]         [HTTP Client]               │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ POST /api/llm.gateway
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Nitro / H3)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  llm.gateway.post.ts                                                        │
│       │                                                                     │
│       ├─→ [1] Auth Check (requireRole)                                      │
│       ├─→ [2] Quota Check (checkUserQuota)                                  │
│       ├─→ [3] Rate Limiting (applyLimit)                                    │
│       ├─→ [4] Request Validation (Zod)                                      │
│       ├─→ [5] Semantic Cache Lookup                                         │
│       ├─→ [6] Model Selection (selectBestModel)                             │
│       ├─→ [7] Strategy Instantiation (LLMFactory)                           │
│       ├─→ [8] LLM API Call (OpenAI / Gemini)                                │
│       ├─→ [9] Database Transaction (save/replace)                           │
│       ├─→ [10] Quota Increment                                              │
│       ├─→ [11] Cache Set                                                    │
│       └─→ [12] Analytics Logging                                            │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  OpenAI API (GPT-3.5/4o)  │  Google AI (Gemini 2.0)  │  Redis (Rate Limit) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Step-by-Step Flow

### **Phase 1: User Initiates Generation**

#### [GenerateButton.vue](app/components/materials/GenerateButton.vue)

```vue
<!-- User clicks dropdown menu option -->
<DropdownMenuItem @click="generate.startGenerate('flashcards')">
  Flashcards
</DropdownMenuItem>
```

**What happens:**
- Displays quota badge (`x/10 remaining`)
- Dropdown menu with "Flashcards" and "Questions" options
- Triggers `generate.startGenerate(type)` on click

---

### **Phase 2: Composable State Machine**

#### [useGenerateFromMaterial.ts](app/composables/materials/useGenerateFromMaterial.ts)

```typescript
export function useGenerateFromMaterial(material: Ref<Material | null>) {
  const state = ref<GenerationState>('idle');
  const existingContent = ref<ExistingContent | null>(null);
  
  // Step 1: Check for existing content
  async function checkExistingContent(): Promise<ExistingContent | null> {
    const response = await $fetch(`/api/materials/${materialId}/content-check`);
    return response.existing || null;
  }
  
  // Step 2: Start generation (shows confirmation if content exists)
  async function startGenerate(type: GenerationType) {
    existingContent.value = await checkExistingContent();
    
    if (existingContent.value?.hasContent) {
      // Show RegenerateConfirmDialog
      state.value = 'confirm-regenerate';
      return;
    }
    
    await executeGeneration(type);
  }
  
  // Step 3: Execute the actual generation
  async function executeGeneration(type: GenerationType) {
    state.value = 'generating';
    
    const result = await gatewayService.generateFlashcards(
      material.value.content,
      {
        materialId: material.value.id,
        save: true,
        replace: true  // Cascade delete existing content + CardReviews
      }
    );
    
    state.value = 'complete';
  }
}
```

**Key Decision Points:**
| Condition | Action |
|-----------|--------|
| No existing content | Proceed directly to generation |
| Has existing flashcards/questions | Show `RegenerateConfirmDialog` |
| User confirms regeneration | Execute with `replace: true` |
| User cancels | Return to idle state |

---

### **Phase 3: Frontend Service Layer**

#### [GatewayService.ts](app/services/GatewayService.ts)

```typescript
export class GatewayService {
  private fetchFactory: FetchFactory;
  
  async generateFlashcards(
    text: string,
    options?: {
      materialId?: string;
      preferredModelId?: string;
      save?: boolean;
      replace?: boolean;
    }
  ): Promise<Result<GatewayGenerateResponse, string>> {
    return this.generate({
      action: 'flashcards',
      text,
      materialId: options?.materialId,
      preferredModelId: options?.preferredModelId,
      save: options?.save ?? false,
      replace: options?.replace ?? false,
    });
  }
  
  private async generate(request: GatewayGenerateRequest) {
    return await this.fetchFactory.post<GatewayGenerateResponse>(
      '/api/llm.gateway',
      request
    );
  }
}
```

---

### **Phase 4: Server Gateway Handler**

#### [llm.gateway.post.ts](server/api/llm.gateway.post.ts) (547 lines)

This is the **core orchestration endpoint**. Here's the complete flow:

---

#### **Step 4.1: Authentication**

```typescript
// Must be authenticated user
const user = await requireRole(event, "user");
const userId = user.user.id;
```

---

#### **Step 4.2: Quota Check**

```typescript
const quotaResult = await checkUserQuota(userId);

if (!quotaResult.canGenerate) {
  throw createError({
    statusCode: 403,
    statusMessage: quotaResult.error || "Generation quota exceeded",
    data: { subscription: quotaResult.subscription }
  });
}
```

**Quota Logic ([quota.ts](server/utils/quota.ts)):**
- FREE tier: 10 generations, decrements on each use
- PRO tier: Unlimited (`canGenerate = true` always)
- Auto-creates subscription record if missing

---

#### **Step 4.3: Rate Limiting**

```typescript
const now = Date.now();
const windowMs = WINDOW_SEC * 1000;  // 60 seconds
const clientIp = getClientIp(event);

// Per-user limit: 5 requests/minute
const userRemaining = await applyLimit(
  `rl:llm:user:${userId}`,
  5,
  userRateLimitMap,
  now,
  windowMs
);

// Per-IP limit: 20 requests/minute
const ipRemaining = await applyLimit(
  `rl:llm:ip:${clientIp}`,
  20,
  ipRateLimitMap,
  now,
  windowMs
);

setRateLimitHeaders(event, Math.min(userRemaining, ipRemaining), userRemaining, ipRemaining, now);
```

**Rate Limiter Logic ([rateLimit.ts](server/utils/llm/rateLimit.ts)):**
- **Primary:** Redis (INCR + EXPIRE)
- **Fallback:** In-memory Map (for dev/serverless)
- Throws 429 if limit exceeded

---

#### **Step 4.4: Request Validation**

```typescript
import { GatewayGenerateRequest } from '~/shared/utils/llm-generate.contract';

const body = await readBody(event);
const parsed = GatewayGenerateRequest.parse(body);
```

**Request Schema:**
```typescript
const GatewayGenerateRequest = z.object({
  action: z.enum(['flashcards', 'quiz']),
  text: z.string().min(10).max(100000),
  materialId: z.string().optional(),
  preferredModelId: z.string().optional(),
  requiredCapability: z.enum(['flashcard', 'quiz']).optional(),
  save: z.boolean().default(false),
  replace: z.boolean().default(false),
});
```

---

#### **Step 4.5: Semantic Cache Lookup**

```typescript
const cacheKey = computeCacheKey(parsed.text, parsed.action);
const cached = await checkSemanticCache(cacheKey);

if (cached) {
  // Return cached response immediately (skip LLM call)
  return {
    success: true,
    ...cached,
    metadata: { cached: true }
  };
}
```

**Cache Implementation:**
- TTL: 7 days
- Key: SHA-256 hash of `text + action`
- Storage: Redis or in-memory fallback

---

#### **Step 4.6: Model Selection (Smart Routing)**

```typescript
const selectedModel = await selectBestModel({
  requiredCapability: parsed.action === 'flashcards' ? 'flashcard' : 'quiz',
  preferredModelId: parsed.preferredModelId,
  estimatedTokens: estimateTokens(parsed.text),
  userTier: quotaResult.subscription.tier,
});
```

**Routing Algorithm ([routing.ts](server/utils/llm/routing.ts)):**

```typescript
function computeModelScore(model: LlmModelRegistry, params: SelectionParams): number {
  // Lower score = better choice
  
  // 1. Base cost (costPer1kTokens)
  let score = model.costPer1kTokens;
  
  // 2. Latency penalty
  score += model.avgLatencyMs * 0.001;  // 1 point per second
  
  // 3. Priority bonus (higher priority = lower score)
  score -= model.priority * 2;
  
  // 4. Capability match bonus
  if (model.capabilities.includes(params.requiredCapability)) {
    score -= 10;
  }
  
  // 5. Health penalty (only for PRO+ users)
  if (params.userTier !== 'FREE' && model.healthScore < 1.0) {
    score += (1 - model.healthScore) * 50;
  }
  
  return score;
}

async function selectBestModel(params: SelectionParams): Promise<LlmModelRegistry> {
  // Fetch active models with required capability
  const candidates = await prisma.llmModelRegistry.findMany({
    where: {
      isActive: true,
      capabilities: { has: params.requiredCapability }
    }
  });
  
  // Score and sort
  const scored = candidates.map(m => ({
    model: m,
    score: computeModelScore(m, params)
  }));
  
  scored.sort((a, b) => a.score - b.score);
  
  // Prefer user's choice if valid
  if (params.preferredModelId) {
    const preferred = scored.find(s => s.model.id === params.preferredModelId);
    if (preferred) return preferred.model;
  }
  
  return scored[0].model;  // Best scoring model
}
```

**Scoring Formula:**
```
score = costPer1kTokens 
      + (avgLatencyMs × 0.001) 
      - (priority × 2) 
      - (capabilityMatch ? 10 : 0) 
      + (userTier !== 'FREE' && healthScore < 1 ? (1 - healthScore) × 50 : 0)
```

---

#### **Step 4.7: Strategy Instantiation**

```typescript
const strategy = await getLLMStrategyFromRegistry(selectedModel.id);
```

**Factory Logic ([LLMFactory.ts](server/utils/llm/LLMFactory.ts)):**

```typescript
export async function getLLMStrategyFromRegistry(modelId: string): Promise<LLMStrategy> {
  const model = await prisma.llmModelRegistry.findUnique({
    where: { id: modelId }
  });
  
  if (!model) throw new Error(`Model ${modelId} not found`);
  
  switch (model.provider) {
    case 'openai':
      return new GPT35Strategy(model.modelId);
    case 'google':
      return new GeminiStrategy(model.modelId);
    default:
      throw new Error(`Unsupported provider: ${model.provider}`);
  }
}
```

---

#### **Step 4.8: LLM API Call**

```typescript
const generationResult = await strategy.generateFlashcards(parsed.text, {
  onMeasure: (usage) => {
    // Token usage callback for logging
    measuredUsage = usage;
  }
});
```

**GPT35Strategy Implementation ([GPT35Strategy.ts](server/utils/llm/GPT35Strategy.ts)):**

```typescript
export class GPT35Strategy implements LLMStrategy {
  private client: OpenAI;
  
  async generateFlashcards(text: string, options?: LLMOptions): Promise<Flashcard[]> {
    // Mock mode for testing
    if (process.env.OPENAI_MOCK === '1') {
      return [
        { front: 'Mock Question 1', back: 'Mock Answer 1' },
        { front: 'Mock Question 2', back: 'Mock Answer 2' },
      ];
    }
    
    const systemPrompt = `You are a flashcard generator. Create flashcards from the provided text.
    Return JSON array: [{"front": "question", "back": "answer"}, ...]`;
    
    const response = await this.client.chat.completions.create({
      model: this.modelId,  // e.g., 'gpt-3.5-turbo' or 'gpt-4o'
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });
    
    // Measure usage
    if (options?.onMeasure && response.usage) {
      options.onMeasure({
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      });
    }
    
    // Parse JSON from response
    const content = response.choices[0].message.content;
    const flashcards = JSON.parse(content);
    
    return flashcards;
  }
}
```

---

#### **Step 4.9: Database Transaction (Save/Replace)**

```typescript
if (parsed.save && parsed.materialId) {
  const saveResult = await prisma.$transaction(async (tx) => {
    let deletedCount = 0;
    let deletedReviewsCount = 0;
    
    // Replace mode: delete existing + cascade CardReviews
    if (parsed.replace) {
      const existingFlashcards = await tx.flashCard.findMany({
        where: { materialId: parsed.materialId },
        select: { id: true }
      });
      
      const flashcardIds = existingFlashcards.map(f => f.id);
      
      // Delete associated CardReviews first
      const reviewsDeleted = await tx.cardReview.deleteMany({
        where: { flashcardId: { in: flashcardIds } }
      });
      deletedReviewsCount = reviewsDeleted.count;
      
      // Then delete flashcards
      const cardsDeleted = await tx.flashCard.deleteMany({
        where: { materialId: parsed.materialId }
      });
      deletedCount = cardsDeleted.count;
    }
    
    // Create new flashcards
    const created = await tx.flashCard.createMany({
      data: generationResult.map(fc => ({
        front: fc.front,
        back: fc.back,
        materialId: parsed.materialId,
        userId: userId,
      }))
    });
    
    return {
      savedCount: created.count,
      deletedCount,
      deletedReviewsCount
    };
  });
}
```

---

#### **Step 4.10: Quota Increment**

```typescript
const updatedSubscription = await incrementGenerationCount(userId);
```

**Increment Logic:**
- Only increments for FREE tier users
- PRO tier: no decrement (unlimited)

---

#### **Step 4.11: Cache Set**

```typescript
await setSemanticCache(cacheKey, {
  flashcards: generationResult,
  action: parsed.action
}, CACHE_TTL_SECONDS);  // 7 days
```

---

#### **Step 4.12: Analytics Logging**

```typescript
await logGatewayRequest({
  userId,
  action: parsed.action,
  modelId: selectedModel.id,
  promptTokens: measuredUsage?.promptTokens || 0,
  completionTokens: measuredUsage?.completionTokens || 0,
  latencyMs: Date.now() - startTime,
  cached: false,
  success: true
});
```

---

### **Phase 5: Response**

```typescript
return {
  success: true,
  flashcards: generationResult,
  savedCount: saveResult?.savedCount || 0,
  deletedCount: saveResult?.deletedCount || 0,
  deletedReviewsCount: saveResult?.deletedReviewsCount || 0,
  subscription: updatedSubscription,
  metadata: {
    requestId: generateRequestId(),
    selectedModelId: selectedModel.id,
    selectedModelName: selectedModel.displayName,
    latencyMs: Date.now() - startTime,
    cached: false,
    tokenUsage: measuredUsage
  }
};
```

---

## 🔀 Alternative Paths

### Legacy Endpoint: `/api/llm.generate`

[llm.generate.post.ts](server/api/llm.generate.post.ts) (310 lines)

| Feature | Gateway (`llm.gateway`) | Legacy (`llm.generate`) |
|---------|-------------------------|-------------------------|
| Model Selection | Auto (smart routing) | Manual (required param) |
| Strategy Factory | `getLLMStrategyFromRegistry()` | `getLLMStrategy()` |
| Model Scoring | ✅ | ❌ |
| Health-Aware | ✅ | ❌ |
| Same Auth/Quota/Rate Limit | ✅ | ✅ |

---

## 🧪 Mock Mode

For testing without API costs:

```bash
# .env
OPENAI_MOCK=1
GEMINI_MOCK=1
```

**Mock Output (GPT35Strategy):**
```json
[
  { "front": "Mock Question 1", "back": "Mock Answer 1" },
  { "front": "Mock Question 2", "back": "Mock Answer 2" }
]
```

---

## ⚙️ Configuration Points

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API access | Yes (prod) |
| `GOOGLE_AI_API_KEY` | Gemini API access | Yes (prod) |
| `REDIS_URL` | Rate limiting & caching | No (fallback: memory) |
| `OPENAI_MOCK` | Skip real API calls | No (dev only) |
| `GEMINI_MOCK` | Skip real API calls | No (dev only) |

### Model Registry (Prisma)

```prisma
model LlmModelRegistry {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  provider       String   // "openai" | "google"
  modelId        String   // "gpt-3.5-turbo" | "gpt-4o" | "gemini-2.0-flash"
  displayName    String
  capabilities   String[] // ["flashcard", "quiz"]
  costPer1kTokens Float
  avgLatencyMs   Int
  priority       Int
  healthScore    Float    @default(1.0)
  isActive       Boolean  @default(true)
}
```

---

## 📈 Metrics & Observability

### Response Headers

```
X-RateLimit-Remaining: 4
X-RateLimit-Remaining-User: 4
X-RateLimit-Remaining-IP: 19
X-RateLimit-Reset: 45
```

### Logged Analytics

```typescript
{
  userId: "user_123",
  action: "flashcards",
  modelId: "model_abc",
  promptTokens: 1500,
  completionTokens: 500,
  latencyMs: 2340,
  cached: false,
  success: true
}
```

---

## 🚨 Error Handling

| Error | HTTP Code | Trigger |
|-------|-----------|---------|
| Not authenticated | 401 | Missing/invalid session |
| Quota exceeded | 403 | FREE tier, 0 remaining |
| Rate limited | 429 | >5/min user or >20/min IP |
| Validation failed | 400 | Invalid request body |
| Model not found | 500 | Invalid preferredModelId |
| LLM API error | 502 | OpenAI/Gemini failure |

---

## 🔄 Complete Sequence Diagram

```
User                UI                  Composable           Service            Server              LLM
 │                   │                      │                   │                  │                  │
 │──Click Generate──▶│                      │                   │                  │                  │
 │                   │──startGenerate()────▶│                   │                  │                  │
 │                   │                      │──checkExisting───▶│──GET /content───▶│                  │
 │                   │                      │◀─────────────────────────────────────│                  │
 │                   │◀─[Show Confirm?]─────│                   │                  │                  │
 │──Confirm─────────▶│                      │                   │                  │                  │
 │                   │──executeGeneration()─▶│                   │                  │                  │
 │                   │                      │──generateCards───▶│                  │                  │
 │                   │                      │                   │──POST /gateway──▶│                  │
 │                   │                      │                   │                  │──checkAuth()     │
 │                   │                      │                   │                  │──checkQuota()    │
 │                   │                      │                   │                  │──applyLimit()    │
 │                   │                      │                   │                  │──checkCache()    │
 │                   │                      │                   │                  │──selectModel()   │
 │                   │                      │                   │                  │──────────────────▶│
 │                   │                      │                   │                  │◀───flashcards────│
 │                   │                      │                   │                  │──$transaction()  │
 │                   │                      │                   │                  │──incrementQuota()│
 │                   │                      │                   │                  │──setCache()      │
 │                   │                      │                   │◀─────response────│                  │
 │                   │                      │◀──────────────────│                  │                  │
 │                   │◀──updateUI───────────│                   │                  │                  │
 │◀──Show Success────│                      │                   │                  │                  │
```

---

## 🏗️ Key Architectural Decisions

### 1. **Strategy Pattern for LLM Providers**
- **Interface:** `LLMStrategy` defines contract (`generateFlashcards`, `generateQuiz`)
- **Implementations:** `GPT35Strategy`, `GeminiStrategy`
- **Benefits:** Easy to add new providers (Anthropic, Mistral, etc.)

### 2. **Smart Routing with Scoring Algorithm**
- **Goal:** Optimize cost/performance trade-off
- **Factors:** Cost per 1k tokens, latency, priority, capability match, health score
- **User Tier Awareness:** PRO users get health-aware fallback, FREE users get cheapest option

### 3. **Dual Rate Limiting (Redis + Memory)**
- **Primary:** Redis for distributed rate limiting (production)
- **Fallback:** In-memory Map for development/serverless environments
- **Limits:** 5 req/min per user, 20 req/min per IP

### 4. **Semantic Caching**
- **Key:** SHA-256 hash of `text + action`
- **TTL:** 7 days
- **Benefit:** Reduces API costs for repeated content

### 5. **Transactional Saves with Cascade Delete**
- **Transaction:** Ensures atomicity (delete old + create new)
- **Cascade:** CardReview records deleted when flashcards replaced
- **Warning:** User notified before deletion via `RegenerateConfirmDialog`

---

## 📚 Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Overall system architecture
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development workflows
- [AI_WORKER_ARCHITECTURE.md](./AI_WORKER_ARCHITECTURE.md) - Offline AI architecture

---

## 🔍 Debugging Tips

### Enable Mock Mode
```bash
# .env
OPENAI_MOCK=1
GEMINI_MOCK=1
```

### Check Rate Limit Status
```bash
curl -H "Cookie: your-session-cookie" \
  http://localhost:3000/api/llm.gateway
# Look at response headers:
# X-RateLimit-Remaining-User
# X-RateLimit-Remaining-IP
```

### View LLM Usage Logs
```typescript
// Check GatewayRequestLog in Prisma Studio
yarn db:studio
// Navigate to GatewayRequestLog table
```

### Test Model Selection
```typescript
// server/utils/llm/routing.ts
console.log('Model scores:', scored);
// Will show score breakdown for each candidate model
```

---

**Document Version:** 1.0  
**Last Updated:** January 1, 2026  
**Maintainer:** Development Team
