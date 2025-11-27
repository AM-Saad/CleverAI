# LLM Gateway Routing Algorithm

**Last Updated**: November 15, 2025  
**Component**: `server/utils/llm/routing.ts`  
**Purpose**: Intelligent model selection for cost optimization, performance, and reliability

---

## Overview

The LLM Gateway automatically selects the optimal AI model for each request by balancing multiple factors:
- **Cost**: Minimize token costs while maintaining quality
- **Latency**: Prefer fast models for better user experience
- **Capabilities**: Match model features to task requirements
- **Reliability**: Avoid degraded or unhealthy models
- **Business Rules**: Admin-controlled priorities and overrides

---

## Core Algorithm: `selectBestModel()`

### Flow Diagram

```
User Request
    ↓
Estimate Tokens (from text length)
    ↓
Preferred Model? ──Yes──→ Valid & Healthy? ──Yes──→ Return Preferred
    ↓ No                        ↓ No
    ↓                    Warn & Fallback
    ↓                           ↓
Fetch Candidate Models ←────────┘
(enabled, healthy, matching capability)
    ↓
Score All Candidates
(cost + latency + priority + capability + health)
    ↓
Sort by Score (lowest = best)
    ↓
PRO+ User? ──Yes──→ Top model degraded? ──Yes──→ Use 2nd if healthy
    ↓ No                    ↓ No
    ↓                       ↓
Return Lowest Score Model
```

### Algorithm Steps

#### 1. Token Estimation
```typescript
const inputTokens = estimateTokensFromText(ctx.inputText)
const outputTokens = ctx.estimatedOutputTokens ?? Math.ceil(inputTokens * 0.6)
```

**Formula**: 
- Input: `(text.length / 3.5) × 1.1` (accounts for markdown/code overhead)
- Output: User hint or 60% of input tokens (typical flashcard ratio)

**Example**:
- 5,000 char text → ~1,571 input tokens
- Expected output → ~943 tokens

#### 2. Preferred Model Override
If a user/folder specifies a preferred model:
- ✅ Use it if: `enabled && healthStatus !== 'down'`
- ❌ Fallback to auto-selection if unavailable
- **Use Case**: Power users who want GPT-4o for everything

#### 3. Candidate Filtering
Query database for eligible models:
```typescript
WHERE:
  enabled = true
  AND healthStatus IN ('healthy', 'degraded')
  AND (requiredCapability IS NULL OR capabilities CONTAINS requiredCapability)
ORDER BY priority ASC
```

**Hard Requirements**:
- Must be enabled (admin control)
- Cannot be completely down
- Must have required capability (e.g., "multimodal" for images)

#### 4. Scoring
Each candidate gets a score using `computeModelScore()` (detailed below).

#### 5. Sorting
```typescript
scored.sort((a, b) => a.score - b.score)
```
Lower score = better choice.

#### 6. PRO+ Health Failover
Premium users get reliability boost:
```typescript
if (ctx.userTier !== 'FREE' && scored.length > 1) {
  const [first, second] = scored.slice(0, 2)
  if (first.model.healthStatus === 'degraded' && 
      second.model.healthStatus === 'healthy') {
    return second // Prefer healthy even if slightly more expensive
  }
}
```

**Example**:
- Free users: Always cheapest (even if degraded)
- PRO users: Sacrifice <10% cost difference for healthy model

---

## Scoring Function: `computeModelScore()`

### Formula

```
Score = BaseCost + LatencyPenalty + PriorityPenalty + CapabilityBonus + HealthPenalty
```

**Lower score = better choice**

### Component Breakdown

#### 1. Base Cost (Primary Factor)

```typescript
const inputCost = (inputTokens / 1_000_000) × model.inputCostPer1M
const outputCost = (outputTokens / 1_000_000) × model.outputCostPer1M
const baseCost = inputCost + outputCost
```

**Purpose**: Minimize token spending

**Example** (1,571 input + 943 output tokens):

| Model | Input Cost | Output Cost | Base Cost |
|-------|-----------|------------|-----------|
| Gemini Flash Lite | $0.000118 | $0.000283 | **$0.000401** |
| GPT-4o-mini | $0.000236 | $0.000566 | **$0.000802** |
| GPT-4o | $0.003928 | $0.009430 | **$0.013358** |

---

#### 2. Latency Penalty

```typescript
const latencyMs = model.avgLatencyMs ?? model.latencyBudgetMs
const latencyOverage = Math.max(0, latencyMs - model.latencyBudgetMs)
const latencyPenalty = (latencyOverage / 1000) × 0.001
```

**Purpose**: Encourage fast responses for better UX

**When Applied**: Only when model is slower than its budget

**Calculation**:
- **Overage**: Actual latency - Expected latency
- **Penalty**: $0.001 per extra second

**Examples**:

##### Fast Model ✅
```
Gemini Flash Lite:
- Budget: 400ms
- Actual: 350ms
- Overage: max(0, 350 - 400) = 0ms
- Penalty: $0.00
```

##### Slow Model ⚠️
```
GPT-4o:
- Budget: 800ms
- Actual: 1,200ms
- Overage: max(0, 1200 - 800) = 400ms
- Penalty: (400 / 1000) × 0.001 = $0.0004
```

**Why This Matters**:
1. **User Experience**: 5-second waits feel broken
2. **Timeout Risk**: Serverless functions have 10-30s limits
3. **Dynamic Adaptation**: If OpenAI slows down, automatically prefer Google
4. **Cost/Benefit**: Given equal cost, choose the fast model

**Latency Tracking**:
- `latencyBudgetMs`: Admin-set expectation (static)
- `avgLatencyMs`: Rolling average from real requests (dynamic)
- Formula: `newAvg = oldAvg × 0.8 + newLatency × 0.2`

---

#### 3. Priority Penalty (Admin Control)

```typescript
const priorityPenalty = model.priority × 0.001
```

**Purpose**: Manual override for business rules

**Scale**: Priority 1-10
- **1 = Highest priority** → Penalty = $0.001 (minimal)
- **5 = Medium** → Penalty = $0.005 (neutral)
- **10 = Lowest priority** → Penalty = $0.010 (avoid)

**Use Cases**:

##### Scenario 1: Rate Limit Approaching 🚨
```
Problem: Hitting OpenAI rate limits
Action: Set all OpenAI models to priority 8-10
Result: Gateway prefers Google/DeepSeek
```

##### Scenario 2: Quality Issues 📉
```
Problem: GPT-3.5 producing bad flashcards this week
Action: Set gpt-3.5 priority to 9
Result: Other models chosen unless GPT-3.5 is dramatically cheaper
```

##### Scenario 3: Vendor Relationships 🤝
```
Problem: Google Cloud credits expiring soon
Action: Set Gemini models to priority 1-2
Result: Aggressively use Gemini to burn credits
```

##### Scenario 4: Model Testing 🧪
```
Problem: Want to beta test new model
Action: Set new model to priority 1
Result: Gets chosen first for real usage data collection
```

**Example Impact**:

| Model | Base Cost | Priority | Priority Penalty | Subtotal |
|-------|-----------|----------|------------------|----------|
| Gemini (P1) | $0.0002 | 1 | +$0.001 | $0.0012 |
| GPT-3.5 (P5) | $0.0001 | 5 | +$0.005 | $0.0051 |
| GPT-4o (P8) | $0.0050 | 8 | +$0.008 | $0.0130 |

Even though GPT-3.5 is cheapest, Gemini wins due to higher priority.

---

#### 4. Capability Bonus

```typescript
const capabilityBonus = ctx.requiredCapability && 
  model.capabilities.includes(ctx.requiredCapability) ? -0.005 : 0
```

**Purpose**: Match model features to task requirements

**When Applied**: Task requires specific capability (e.g., "multimodal")

**Available Capabilities**:
- `text`: Basic text generation (all models)
- `multimodal`: Image/video understanding
- `chat`: Conversational context
- `realtime`: Voice/streaming

**Filtering Logic**:

##### Stage 1: Hard Filter (Database Query)
```typescript
WHERE capabilities CONTAINS requiredCapability
```
Models without the capability are **completely excluded**.

##### Stage 2: Soft Bonus (Scoring)
```typescript
-$0.005 bonus for models with the capability
```
Helps tie-breaking among qualified models.

**Examples**:

##### Text-Only Task (Flashcards) ✅
```
ctx.requiredCapability = undefined
Result: All models eligible, no bonus
```

##### Image-Based Flashcards 🖼️
```
ctx.requiredCapability = "multimodal"

Available:
- ❌ Gemini Flash Lite (only "text", "chat") → Excluded
- ✅ Gemini 2.0 Flash ("text", "multimodal", "chat") → -$0.005 bonus
- ✅ GPT-4o ("text", "multimodal", "realtime") → -$0.005 bonus
```

##### Voice Tutoring 🎤
```
ctx.requiredCapability = "realtime"

Available:
- ✅ GPT-4o only → Auto-selected (only candidate)
```

---

#### 5. Health Penalty

```typescript
const healthPenalty = model.healthStatus === 'degraded' ? 0.01 : 0
```

**Purpose**: Avoid unreliable models

**Health States**:
- `healthy`: Normal operation → No penalty
- `degraded`: Partial issues (high error rate, slow) → +$0.01 penalty
- `down`: Complete failure → Excluded from candidates

**When a Model is Degraded**:
- High API error rate (>5% in last hour)
- Timeouts increasing
- Provider status page issues
- Manual admin override

**Example**:
```
Two models cost the same:
- Model A: Healthy → Score = $0.005
- Model B: Degraded → Score = $0.005 + $0.01 = $0.015

Model A wins (3x better score)
```

**PRO+ Override**: Premium users get automatic failover (see Step 6 above)

---

## Real-World Example: Complete Calculation

**Request**: Generate flashcards from 5,000 characters

### Input Context
```typescript
ctx = {
  userId: "user123",
  task: "flashcards",
  inputText: "..." // 5000 chars
  requiredCapability: undefined, // text-only
  userTier: "FREE",
}
```

### Token Estimation
- Input: 5000 / 3.5 × 1.1 ≈ **1,571 tokens**
- Output: 1571 × 0.6 ≈ **943 tokens**

### Model Scores

#### Gemini Flash Lite (Priority 1)
```
Base Cost:
  Input:  (1571 / 1M) × $0.075 = $0.000118
  Output: (943 / 1M) × $0.300 = $0.000283
  Total:                         $0.000401

Latency Penalty:
  Budget: 400ms
  Actual: 350ms (rolling average)
  Overage: 0ms
  Penalty:                       $0.000000

Priority Penalty:
  Priority: 1
  Penalty: 1 × 0.001 =           $0.001000

Capability Bonus:
  Required: none
  Bonus:                         $0.000000

Health Penalty:
  Status: healthy
  Penalty:                       $0.000000

FINAL SCORE:                     $0.001401
```

#### GPT-4o-mini (Priority 2)
```
Base Cost:                       $0.000802
Latency Penalty:                 $0.000000
Priority Penalty: 2 × 0.001 =    $0.002000
Capability Bonus:                $0.000000
Health Penalty:                  $0.000000

FINAL SCORE:                     $0.002802
```

#### GPT-4o (Priority 8)
```
Base Cost:                       $0.013358
Latency Penalty:                 $0.000400 (1200ms vs 800ms budget)
Priority Penalty: 8 × 0.001 =    $0.008000
Capability Bonus:                $0.000000
Health Penalty:                  $0.000000

FINAL SCORE:                     $0.021758
```

### Winner: Gemini Flash Lite 🏆
- **Score**: $0.001401 (lowest)
- **Savings**: 2x cheaper than GPT-4o-mini, 15x cheaper than GPT-4o
- **Reason**: Lowest base cost + highest priority + fast response

---

## Configuration & Admin Controls

### Model Registry (Database)

Each model has these tunable parameters:

```typescript
{
  modelId: 'gemini-2.0-flash-lite',
  provider: 'google',
  modelName: 'gemini-2.0-flash-lite',
  inputCostPer1M: 0.075,      // ← Update when pricing changes
  outputCostPer1M: 0.300,     // ← Update when pricing changes
  capabilities: ['text', 'chat'],
  maxTokens: 32000,
  latencyBudgetMs: 400,       // ← Expected response time
  avgLatencyMs: 350,          // ← Auto-updated from real requests
  healthStatus: 'healthy',    // ← Auto-updated by health checks
  priority: 1,                // ← Admin control: 1=prefer, 10=avoid
  enabled: true,              // ← Admin control: disable completely
}
```

### Admin Actions

#### Disable a Model
```typescript
await prisma.llmModelRegistry.update({
  where: { modelId: 'gpt-4o' },
  data: { enabled: false }
})
```
**Effect**: Model excluded from all routing decisions

#### Adjust Priority
```typescript
await prisma.llmModelRegistry.update({
  where: { modelId: 'gpt-3.5' },
  data: { priority: 9 }
})
```
**Effect**: Model avoided unless dramatically cheaper

#### Update Pricing
```typescript
await prisma.llmModelRegistry.update({
  where: { modelId: 'openai-gpt4o-mini' },
  data: {
    inputCostPer1M: 0.125,  // New pricing
    outputCostPer1M: 0.500,
  }
})
```
**Effect**: Routing immediately reflects new costs

#### Mark as Degraded
```typescript
await prisma.llmModelRegistry.update({
  where: { modelId: 'claude-3' },
  data: { healthStatus: 'degraded' }
})
```
**Effect**: +$0.01 penalty, PRO users auto-failover

---

## Monitoring & Observability

### Key Metrics

#### 1. Model Selection Distribution
```sql
SELECT 
  selectedModelId,
  COUNT(*) as requests,
  AVG(latencyMs) as avg_latency,
  SUM(totalCostUsdMicros) / 1000000 as total_cost
FROM llm_gateway_logs
WHERE createdAt > NOW() - INTERVAL 7 DAYS
GROUP BY selectedModelId
ORDER BY requests DESC
```

**What to Look For**:
- One model dominating (cost inefficiency?)
- Expensive models being used (check priority settings)
- Distribution across providers (resilience)

#### 2. Latency Tracking
```sql
SELECT 
  selectedModelId,
  AVG(latencyMs) as avg_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latencyMs) as p95_latency
FROM llm_gateway_logs
WHERE status = 'success' AND createdAt > NOW() - INTERVAL 1 DAY
GROUP BY selectedModelId
```

**What to Look For**:
- Models exceeding their latency budget
- Sudden latency spikes (health degradation)

#### 3. Error Rates
```sql
SELECT 
  selectedModelId,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*)) as error_rate
FROM llm_gateway_logs
WHERE createdAt > NOW() - INTERVAL 1 HOUR
GROUP BY selectedModelId
HAVING error_rate > 5
```

**Action**: Mark models with >5% error rate as `degraded`

#### 4. Cost Analysis
```sql
SELECT 
  DATE(createdAt) as date,
  selectedModelId,
  SUM(totalCostUsdMicros) / 1000000 as daily_cost,
  COUNT(*) as requests
FROM llm_gateway_logs
WHERE createdAt > NOW() - INTERVAL 30 DAYS
GROUP BY DATE(createdAt), selectedModelId
ORDER BY date DESC, daily_cost DESC
```

**What to Look For**:
- Daily burn rate trends
- Unexpected cost spikes
- Optimization opportunities

---

## Edge Cases & Special Scenarios

### 1. All Models Degraded
```
Situation: Provider outage affecting all models
Behavior: Use least-degraded option (all get +$0.01 penalty equally)
Mitigation: PRO users still get healthy failover if any healthy model exists
```

### 2. No Models Match Capability
```
Situation: Request needs "multimodal" but no models have it
Behavior: Throw error "No healthy models available"
Mitigation: Ensure at least one model for each capability type
```

### 3. Preferred Model Down
```
Situation: User folder set to "gpt-4o" but model is down
Behavior: Log warning, fallback to auto-selection
User Impact: May see different model used temporarily
```

### 4. Extreme Token Counts
```
Situation: User tries to generate from 50,000 char text
Behavior: Estimates ~15,714 input tokens
Selection: Heavily favors models with large context windows
Note: API handler validates max 10,000 chars before routing
```

### 5. Tie Scores
```
Situation: Two models have identical scores
Behavior: Database ORDER BY priority means lower priority wins tie
Improvement: Could add random tie-breaking for A/B testing
```

---

## Future Enhancements

### 1. Provider Diversity Bonus
```typescript
const lastFailedProvider = await getLastFailedProvider()
const diversityBonus = lastFailedProvider === model.provider ? 0.001 : 0
```
**Benefit**: Automatic failover during provider outages

### 2. Quality Score Integration
```typescript
const qualityPenalty = model.avgQualityScore < 0.8 ? 0.005 : 0
```
**Metric**: Track user feedback, regeneration rate, saved vs generated ratio

### 3. Context Window Optimization
```typescript
const contextOverflow = inputTokens > model.maxTokens ? 999 : 0
```
**Benefit**: Auto-exclude models that can't handle request size

### 4. Regional Routing
```typescript
const geoLatencyBonus = model.region === ctx.userRegion ? -0.002 : 0
```
**Benefit**: Prefer closer data centers for lower latency

### 5. Batch Request Optimization
```typescript
const batchEfficiency = model.supportsBatch && ctx.batchSize > 1 ? -0.003 : 0
```
**Benefit**: Use batch-optimized models for bulk generation

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **Base Cost** | USD cost of input + output tokens |
| **Latency Budget** | Expected/acceptable response time (ms) |
| **Latency Overage** | Actual latency - budget (0 if faster) |
| **Priority** | Admin-set preference (1=highest, 10=lowest) |
| **Capability** | Feature support (text, multimodal, realtime) |
| **Health Status** | Model reliability (healthy, degraded, down) |
| **Rolling Average** | Smoothed metric: `new = old × 0.8 + current × 0.2` |
| **Scoring** | Algorithm to rank models (lower = better) |
| **Hard Filter** | Database WHERE clause (absolute requirement) |
| **Soft Bonus** | Score adjustment (preference, not requirement) |

---

## References

- Implementation: `server/utils/llm/routing.ts`
- Model Registry: `server/utils/llm/modelRegistry.ts`
- Gateway API: `server/api/llm.gateway.post.ts`
- Cost Tracking: `server/utils/llm/gatewayLogger.ts`
- Database Schema: `server/prisma/schema.prisma` (LlmModelRegistry, LlmGatewayLog)
