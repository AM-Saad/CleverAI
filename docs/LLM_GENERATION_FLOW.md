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
│       ├─→ [8] LLM API Call (OpenAI / Gemini / DeepSeek)                    │
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
│  OpenAI API (GPT-3.5/4o)  │  Google AI (Gemini)  │  DeepSeek API           │
│                           │                      │  Redis (Rate Limit)     │
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
export function useGenerateFromMaterial(materialId: Ref<string>) {
  const state = ref<GenerationState>('idle');
  const existingContent = ref<ExistingContent | null>(null);
  
  // Step 1: Check for existing content
  async function checkExistingContent(): Promise<ExistingContent | null> {
    const response = await $api.materials.getGeneratedContent(materialId.value);
    return response.success ? response.data : null;
  }
  
  // Step 2: Start generation (shows confirmation if content exists)
  async function startGenerate(type: GenerationType) {
    existingContent.value = await checkExistingContent();
    
    if (existingContent.value?.hasContent) {
      // Show RegenerateConfirmDialog (user chooses replace or not)
      state.value = 'confirm-regenerate';
      return;
    }
    
    await executeGeneration(type);
  }
  
  // Step 3: Execute the actual generation
  async function executeGeneration(type: GenerationType, replace = false) {
    state.value = 'generating';
    
    const result = await gatewayService.generateFlashcards(text, {
      materialId: materialId.value,
      save: true,
      replace, // User-controlled replace behavior
    });
    
    state.value = 'complete';
  }
}
```

**Key Decision Points:**
| Condition | Action |
|-----------|--------|
| No existing content | Proceed directly to generation |
| Has existing flashcards/questions | Show `RegenerateConfirmDialog` |
| User confirms regeneration | Execute with `replace` checkbox value (user controls whether to delete old content) |
| User cancels | Return to idle state |

**Regeneration Behavior:**
- **`replace=false` (default)**: Append new items to existing collection (no deletion)
- **`replace=true`**: Delete old items + CardReviews, create new items (user explicitly confirmed)
- RegenerateConfirmDialog shows checkbox allowing user to choose deletion behavior

---

### **Phase 3: Frontend Service Layer**

#### [GatewayService.ts](app/services/GatewayService.ts)

```typescript
export class GatewayService {
  private fetchFactory: FetchFactory;
  
  async generateFlashcards(
    text: string,
    options?: {
      workspaceId?: string;
      materialId?: string;
      save?: boolean;
      replace?: boolean;
      preferredModelId?: string;
      requiredCapability?: 'text' | 'multimodal' | 'reasoning';
      generationConfig?: GenerationConfig;
    }
  ): Promise<GatewayGenerateResponse> {
    return this.generate({
      task: 'flashcards',
      text,
      ...options,
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
const user = await requireRole(event, ["USER"]);
const userId = user.id;
```

---

#### **Step 4.2: Quota Check**

```typescript
const quotaResult = await checkUserQuota(userId);

if (!quotaResult.canGenerate) {
  // Returns 400 (bad request) with quota headers and subscription payload
  throw Errors.badRequest(
    "Free tier quota exceeded. Please upgrade to continue generating content.",
    { subscription: quotaResult.subscription, type: "QUOTA_EXCEEDED" }
  );
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
const parsed = GatewayGenerateRequest.safeParse(body);
```

**Request Schema:**
```typescript
const GatewayGenerateRequest = z.object({
  task: z.enum(['flashcards', 'quiz']),
  text: z.string().min(1).max(100000).optional(),
  workspaceId: z.string().optional(),
  materialId: z.string().optional(),
  preferredModelId: z.string().optional(),
  requiredCapability: z.enum(['text', 'multimodal', 'reasoning']).optional(),
  generationConfig: z.object({
    depth: z.enum(['quick', 'balanced', 'deep']).optional(),
    maxItems: z.number().int().positive().optional(),
  }).optional(),
  save: z.boolean().default(false),
  replace: z.boolean().default(false),
});
```

**Material/Workspace Permissions:**
- If `materialId` is provided, the gateway loads the material and replaces `text` with `material.content`.
- Ownership is enforced via `material.workspace.userId === user.id`.
- If `save` is true, workspace/material ownership is required before saving.
- If no `materialId` is provided, `text` is required and must be non-empty.

---

#### **Step 4.5: Adaptive Item Count + Semantic Cache Lookup**

```typescript
const tokenEstimate = estimateTokensFromText(text);
const depth = generationConfig?.depth ?? 'balanced';
const itemCount = computeAdaptiveItemCount(tokenEstimate, depth, generationConfig?.maxItems);

const cacheCheck = await checkSemanticCache(text, task, itemCount);

if (cacheCheck.hit && cacheCheck.value) {
  // Return cached response immediately (skip LLM call)
  return {
    success: true,
    ...cacheCheck.value,
    cached: true,
    itemCount,
    tokenEstimate
  };
}
```

**Important:** Cached responses still increment quota usage and are logged for cost accounting.

**Cache Implementation:**
- TTL: 7 days
- Key: derived from `text + task + itemCount` (prompt versioned in tokenEstimate util)
- Storage: Redis or in-memory fallback

---

#### **Step 4.6: Model Selection (Smart Routing)**

```typescript
const selectedModel = await selectBestModel({
  userId: user.id,
  task,
  inputText: text,
  estimatedOutputTokens: task === 'flashcards' ? 500 : 800,
  userTier: quotaCheck.subscription.tier,
  preferredModelId,
  requiredCapability,
});
```

**Routing Algorithm ([routing.ts](server/utils/llm/routing.ts)):**

```typescript
function computeModelScore(model: LlmModelRegistry, inputTokens: number, outputTokens: number, ctx: RoutingContext) {
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M
  const baseCost = inputCost + outputCost

  const latencyMs = model.avgLatencyMs ?? model.latencyBudgetMs
  const latencyOverage = Math.max(0, latencyMs - model.latencyBudgetMs)
  const latencyPenalty = (latencyOverage / 1000) * 0.001

  const priorityPenalty = model.priority * 0.001
  const capabilityBonus = ctx.requiredCapability && model.capabilities.includes(ctx.requiredCapability)
    ? -0.005 : 0
  const healthPenalty = model.healthStatus === 'degraded' ? 0.01 : 0

  return baseCost + latencyPenalty + priorityPenalty + capabilityBonus + healthPenalty
}
```

**Selection Logic:**
- If `preferredModelId` is provided and enabled/healthy → use it.
- Otherwise score all enabled, healthy candidates and choose lowest score.
- For PRO+ users, prefer healthy over degraded if top two are close.

**Scoring Formula:**
```
score = baseCost (input+output USD)
  + latencyPenalty (over budget)
  + priorityPenalty (higher = worse)
  + healthPenalty (degraded = worse)
  + capabilityBonus (match = better)
```

---

#### **Step 4.7: Strategy Instantiation**

```typescript
const strategy = await getLLMStrategyFromRegistry(selectedModel.modelId);
```

**Factory Logic ([LLMFactory.ts](server/utils/llm/LLMFactory.ts)):**

```typescript
export async function getLLMStrategyFromRegistry(modelId: string): Promise<LLMStrategy> {
  const model = await prisma.llmModelRegistry.findUnique({
    where: { modelId }
  });
  
  if (!model) throw new Error(`Model ${modelId} not found`);
  
  switch (model.provider) {
    case 'openai':
      return new OpenAIStrategy(model.modelId);
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
const generationResult = await strategy.generateFlashcards(text, {
  itemCount
});
```

**OpenAIStrategy Implementation ([OpenAIStrategy.ts](server/utils/llm/OpenAIStrategy.ts)):**

```typescript
export class OpenAIStrategy implements LLMStrategy {
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
if (canSave && effectiveWorkspaceId) {
  try {
    if (task === "flashcards") {
      // Use transaction to ensure atomic delete + create
      await prisma.$transaction(async (tx) => {
        // If replacing for a specific material, delete old flashcards and their CardReviews
        if (replace && materialId) {
          // Get IDs of flashcards to be deleted for CardReview cleanup
          const oldFlashcards = await tx.flashcard.findMany({
            where: { materialId },
            select: { id: true },
          });
          const oldFlashcardIds = oldFlashcards.map((f) => f.id);

          // Delete CardReviews for these flashcards
          if (oldFlashcardIds.length > 0) {
            const reviewsDeleted = await tx.cardReview.deleteMany({
              where: {
                cardId: { in: oldFlashcardIds },
                resourceType: "flashcard",
              },
            });
            deletedReviewsCount = reviewsDeleted.count;
          }

          // Delete old flashcards
          const deleted = await tx.flashcard.deleteMany({
            where: { materialId },
          });
          deletedCount = deleted.count;
        }

        // Create new flashcards
        if (result.length) {
          const res = await tx.flashcard.createMany({
            data: (result as Flashcard[]).map((fc) => ({
              workspaceId: effectiveWorkspaceId,
              materialId: materialId || null,
              front: fc.front,
              back: fc.back,
            })),
          });
          savedCount = res.count;
        } else {
          savedCount = 0;
        }
      });
    } else {
      // Quiz/Questions
      await prisma.$transaction(async (tx) => {
        // If replacing for a specific material, delete old questions and their CardReviews
        if (replace && materialId) {
          // Get IDs of questions to be deleted for CardReview cleanup
          const oldQuestions = await tx.question.findMany({
            where: { materialId },
            select: { id: true },
          });
          const oldQuestionIds = oldQuestions.map((q) => q.id);

          // Delete CardReviews for these questions
          if (oldQuestionIds.length > 0) {
            const reviewsDeleted = await tx.cardReview.deleteMany({
              where: {
                cardId: { in: oldQuestionIds },
                resourceType: "question",
              },
            });
            deletedReviewsCount = reviewsDeleted.count;
          }

          // Delete old questions
          const deleted = await tx.question.deleteMany({
            where: { materialId },
          });
          deletedCount = deleted.count;
        }

        // Create new questions
        if (result.length) {
          const res = await tx.question.createMany({
            data: (result as QuizQuestion[]).map((q) => ({
              workspaceId: effectiveWorkspaceId,
              materialId: materialId || null,
              question: q.question,
              choices: q.choices,
              answerIndex: q.answerIndex,
            })),
          });
          savedCount = res.count;
        } else {
          savedCount = 0;
        }
      });
    }
  } catch (err) {
    console.error("[llm.gateway] Failed to save to database:", {
      requestId,
      workspaceId: effectiveWorkspaceId,
      materialId,
      task,
      error: err,
    });
    // Don't throw - generation succeeded even if save failed
  }
}
```

**Key Changes from Previous Implementation:**
1. **Append-Only by Default**: `replace` parameter controls whether to delete existing content
2. **CardReview Cascade Cleanup**: When `replace=true`, CardReviews are deleted alongside flashcards/questions
3. **Questions Support**: Full transaction support for quiz questions with same pattern as flashcards
4. **User-Controlled**: Frontend shows `RegenerateConfirmDialog` allowing users to choose replace behavior

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
await setSemanticCache(text, task, {
  ...(task === 'flashcards' ? { flashcards: generationResult } : { quiz: generationResult }),
  modelId: selectedModel.modelId,
  provider: selectedModel.provider,
}, CACHE_TTL_SECONDS, itemCount);  // 7 days
```

---

#### **Step 4.12: Analytics Logging**

```typescript
await logGatewayRequest({
  requestId,
  userId,
  workspaceId,
  selectedModel,
  task,
  inputTokens: estimatedInputTokens,
  outputTokens: estimatedOutputTokens,
  totalTokens: estimatedInputTokens + estimatedOutputTokens,
  latencyMs,
  cached: false,
  cacheHit: false,
  status: 'success',
  itemCount,
  tokenEstimate,
  depth,
});
```

---

### **Phase 5: Response**

```typescript
return {
  task,
  flashcards | quiz,
  savedCount,
  deletedCount,
  deletedReviewsCount,
  subscription,
  requestId,
  selectedModelId,
  provider,
  latencyMs,
  cached,
  itemCount,
  tokenEstimate,
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

**Mock Output (OpenAIStrategy):**
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
| `DEEPSEEK_API_KEY` | DeepSeek API access | No (optional provider) |
| `REDIS_URL` | Rate limiting & caching | No (fallback: memory) |
| `OPENAI_MOCK` | Skip real API calls | No (dev only) |
| `GEMINI_MOCK` | Skip real API calls | No (dev only) |
| `DEEPSEEK_MOCK` | Skip real API calls | No (dev only) |

### Model Registry (Prisma)

```prisma
model LlmModelRegistry {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  provider       String   // "openai" | "google" | "deepseek"
  modelId        String   // "gpt-3.5-turbo" | "gemini-2.0-flash" | "deepseek-chat"
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
  task: "flashcards",
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
| Quota exceeded | 400 | FREE tier, 0 remaining |
| Rate limited | 429 | >5/min user or >20/min IP |
| Validation failed | 400 | Invalid request body |
| Model not found | 404 | Invalid preferredModelId or registry entry missing |
| LLM API error | 500 | Provider failure or generation error |

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
- **Implementations:** `OpenAIStrategy`, `GeminiStrategy`
- **Benefits:** Easy to add new providers (Anthropic, Mistral, etc.)

### 2. **Smart Routing with Scoring Algorithm**
- **Goal:** Optimize cost/performance trade-off
- **Factors:** Cost per 1M tokens (input/output), latency budget overage, priority penalty, capability bonus, health penalty
- **User Tier Awareness:** PRO users get health-aware fallback, FREE users get lowest score

### 3. **Dual Rate Limiting (Redis + Memory)**
- **Primary:** Redis for distributed rate limiting (production)
- **Fallback:** In-memory Map for development/serverless environments
- **Limits:** 5 req/min per user, 20 req/min per IP

### 4. **Semantic Caching**
- **Key:** Derived from `text + task + itemCount` (prompt versioned)
- **TTL:** 7 days
- **Benefit:** Skips LLM call but **does not** bypass quota/cost accounting

### 5. **User-Controlled Replace with CardReview Cascade**
- **Default Behavior:** Append-only (no deletion) to preserve user progress
- **Replace Option:** User can explicitly choose to delete old items via checkbox in RegenerateConfirmDialog
- **Cascade Delete:** When `replace=true`, CardReview records are deleted alongside flashcards/questions
- **Transaction:** Ensures atomicity (delete old + create new happens together or not at all)
- **Supported Types:** Both flashcards and questions support replace with CardReview cleanup

### 6. **Question Enrollment Integration**
- **Polymorphic CardReview:** `resourceType` field supports "material", "flashcard", and "question"
- **Queue Fetching:** Questions fetched in parallel with materials and flashcards for optimal performance
- **UI Parity:** Questions.vue matches FlashCards.vue pattern with enrollment tracking and status indicators
- **Same SM-2 Algorithm:** Questions use identical spaced repetition logic as flashcards

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
