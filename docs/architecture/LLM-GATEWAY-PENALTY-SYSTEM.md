# LLM Gateway Penalty System: How Slow Models Recover

**Last Updated**: November 15, 2025  
**Component**: `server/utils/llm/routing.ts`, `server/utils/llm/modelRegistry.ts`  
**Purpose**: Explain how the gateway handles model performance degradation and automatic recovery

---

## Executive Summary

The LLM Gateway uses a **soft penalty system** rather than hard blacklisting. When a model becomes slow:
- ✅ It's **deprioritized** (used less), not blocked completely
- ✅ It continues to receive **10-30% of traffic** through various mechanisms
- ✅ Performance is **continuously monitored** on all uses
- ✅ Penalty **automatically adjusts** as latency improves
- ✅ Model **self-heals** without admin intervention

**Key Insight**: Penalties are **weighted preferences**, not **binary on/off switches**.

---

## What "Penalty" Actually Means

### ❌ Common Misconceptions

| Myth | Reality |
|------|---------|
| "Penalized = Blocked" | Penalized = Less likely to be chosen |
| "Model stops being used" | Model gets 10-30% traffic instead of 90% |
| "Needs admin to recover" | Recovers automatically via rolling average |
| "Penalty is permanent" | Penalty adjusts every ~10-20 requests |
| "Binary decision" | Continuous scoring with gradual changes |

### ✅ Correct Understanding

**Penalties add a cost handicap** to the model's score:
- Small penalty: Model needs to be ~10% cheaper to win
- Large penalty: Model needs to be ~50% cheaper to win
- Model can **still win** if it's significantly cheaper despite being slow

**Think of it like**: Adding a "slowness tax" that other models don't have to pay.

---

## Real Example: GPT-4o Slowdown & Recovery

### Timeline Breakdown

#### Day 0: Normal Operation ✅
```
GPT-4o Performance:
- avgLatencyMs: 750ms
- latencyBudgetMs: 800ms
- Overage: 0ms
- Penalty: $0.0000

Score Calculation:
- Base Cost: $0.0001
- Latency Penalty: $0.0000
- Priority Penalty: $0.002
- Final Score: $0.0003

Competing Models:
- Gemini: $0.0005 (slower but more expensive)

Result: GPT-4o wins 100% of requests
```

---

#### Day 1: Degradation Begins 🟡
```
OpenAI infrastructure issues...

Request 1: 1,200ms response
- New avgLatencyMs: 750 × 0.8 + 1,200 × 0.2 = 840ms
- Overage: 840 - 800 = 40ms
- Penalty: (40 / 1000) × 0.001 = $0.00004
- Score: $0.0001 + $0.00004 + $0.002 = $0.00304

Gemini Score: $0.0005 → Gemini wins this request!

Request 2-10: Continue slow (1,200ms each)
- avgLatencyMs climbs: 840 → 912 → 970 → 1,016 → 1,053 → 1,082...
- Penalty grows: $0.00004 → $0.00011 → $0.00017 → $0.00022...
- GPT-4o wins: 40% of requests (still competitive)
- Gemini wins: 60% of requests
```

**Key Point**: Model doesn't suddenly stop being used; it gradually loses market share.

---

#### Day 2: Full Degradation 🔴
```
After 50+ slow requests...

GPT-4o:
- avgLatencyMs: 1,500ms (stabilized)
- Overage: 1,500 - 800 = 700ms
- Penalty: (700 / 1000) × 0.001 = $0.0007
- Score: $0.0001 + $0.0007 + $0.002 = $0.0027

Gemini:
- Score: $0.0005 (no latency penalty)

Result: Gemini wins 90% of requests
BUT: GPT-4o still used 10% of time!
```

**Why GPT-4o still gets traffic**:
1. Users with `preferredModelId: 'gpt-4o'` override scoring
2. Gemini hits rate limit → fallback to GPT-4o
3. Requests where GPT-4o is only model with required capability
4. Very small requests where base cost difference overcomes penalty

---

#### Day 3: Recovery Begins 🟢
```
OpenAI fixes infrastructure issues...

GPT-4o's 10% traffic starts responding fast again:

Request 1 (10% traffic): 800ms
- New avgLatencyMs: 1,500 × 0.8 + 800 × 0.2 = 1,360ms
- Penalty: (1,360 - 800) / 1000 × 0.001 = $0.00056
- Score: $0.0001 + $0.00056 + $0.002 = $0.00266 → Still loses

Request 2 (10% traffic): 750ms
- New avgLatencyMs: 1,360 × 0.8 + 750 × 0.2 = 1,238ms
- Penalty: (1,238 - 800) / 1000 × 0.001 = $0.00044
- Score: $0.0001 + $0.00044 + $0.002 = $0.00254 → Still loses

Request 5 (10% traffic): 750ms
- New avgLatencyMs: 1,088ms (after several fast responses)
- Penalty: (1,088 - 800) / 1000 × 0.001 = $0.00029
- Score: $0.0001 + $0.00029 + $0.002 = $0.00229 → Getting close!

Request 8 (10% traffic): 750ms
- New avgLatencyMs: 970ms
- Penalty: (970 - 800) / 1000 × 0.001 = $0.00017
- Score: $0.0001 + $0.00017 + $0.002 = $0.00217 → Beats Gemini!

GPT-4o starts winning more requests → Gets more traffic → 
Faster latency updates → Penalty drops faster → 
Positive feedback loop
```

---

#### Day 4: Full Recovery ✅
```
After ~50 fast responses through gradual traffic increase...

GPT-4o:
- avgLatencyMs: 780ms (back to normal)
- Overage: 0ms (faster than budget!)
- Penalty: $0.0000
- Score: $0.0001 + $0.0000 + $0.002 = $0.0002

Gemini:
- Score: $0.0005

Result: GPT-4o wins 95% of requests again
```

**Total recovery time**: ~3-4 days with 10% baseline traffic  
**Admin intervention required**: None  
**System adapted**: Automatically

---

## The Feedback Loop Mechanism

```
┌─────────────────────────────────────────────────────────────┐
│                     DEGRADATION CYCLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Model slow → Penalty added → Score increases →            │
│       ↑                                            ↓        │
│       │                                            │        │
│  Still gets 10-30% traffic ← Loses most selections│        │
│       ↑                                            ↓        │
│       │                                                     │
│  avgLatency measured on those uses                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      RECOVERY CYCLE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Performance improves → avgLatency drops → Penalty shrinks →│
│       ↑                                              ↓      │
│       │                                              │      │
│  Gets more traffic ← Score improves ← Becomes competitive   │
│       ↑                                              ↓      │
│       │                                                     │
│  More measurements → Faster convergence to true latency    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Self-Correcting Property**: The system naturally stabilizes around the true performance of each model.

---

## Why Models Keep Getting Traffic Even When Penalized

### 1. User/Folder Preferences (Bypass Scoring)

```typescript
// In selectBestModel():
if (ctx.preferredModelId) {
  const preferred = await prisma.llmModelRegistry.findUnique({
    where: { modelId: ctx.preferredModelId }
  })
  
  if (preferred && preferred.enabled && preferred.healthStatus !== 'down') {
    return preferred // Penalty doesn't apply
  }
}
```

**Impact**: If 5% of users explicitly prefer GPT-4o, it gets 5% traffic regardless of penalty.

---

### 2. Required Capabilities (No Alternatives)

```typescript
// Database query filters by capability:
const candidates = await prisma.llmModelRegistry.findMany({
  where: {
    enabled: true,
    healthStatus: { in: ['healthy', 'degraded'] },
    capabilities: { has: ctx.requiredCapability } // ← Hard filter
  }
})
```

**Example**:
```
Request: Generate flashcards from image (multimodal)

Available models:
- GPT-4o: Has "multimodal" → Selected despite being slow
- Gemini Flash Lite: Text-only → Excluded

Result: GPT-4o gets 100% of multimodal requests
```

---

### 3. Rate Limit Fallbacks

```
Scenario: High traffic spike

Request 1-60: Gemini selected (within rate limit)
Request 61: Gemini rate limited (429 error)
  → Gateway tries next-best model
  → GPT-4o selected (despite penalty)
Request 62-120: Gemini available again
Request 121: Gemini rate limited again
  → GPT-4o selected

Result: GPT-4o gets ~5-10% traffic from overflow
```

---

### 4. Cost Advantage Overcoming Penalty

```
Very short request (100 input + 60 output tokens):

GPT-4o:
  Base: $0.000015 + Penalty: $0.0007 = $0.000715

Gemini:
  Base: $0.000012 + Penalty: $0.0000 = $0.000012

Result: Gemini wins (base cost too close to overcome penalty)

---

Very long request (5,000 input + 3,000 output tokens):

GPT-4o:
  Base: $0.004250 + Penalty: $0.0007 = $0.004950

Gemini:
  Base: $0.005375 + Penalty: $0.0000 = $0.005375

Result: GPT-4o wins! (Large base cost difference overcomes penalty)
```

**Insight**: Penalty is a fixed dollar amount, so its impact varies by request size.

---

### 5. PRO+ User Failover (Reverse Direction)

```typescript
// PRO users prefer healthy models:
if (ctx.userTier !== 'FREE' && scored.length > 1) {
  const [first, second] = scored.slice(0, 2)
  if (first.model.healthStatus === 'degraded' && 
      second.model.healthStatus === 'healthy') {
    return second // Choose 2nd even if 1st has lower score
  }
}
```

**Example**:
```
GPT-4o (degraded): Score $0.0020 ✅ Lowest
Gemini (healthy): Score $0.0025

Free users: Get GPT-4o (cheapest)
PRO users: Get Gemini (healthy) ← More GPT-4o capacity freed up
```

**Effect**: PRO users' preference for health actually gives degraded models MORE traffic from free users.

---

## Rolling Average: How avgLatencyMs Updates

### Formula
```typescript
newAvg = oldAvg × 0.8 + currentLatency × 0.2
```

**Why 80/20?**
- **80% old**: Prevents single outlier from causing drastic change
- **20% new**: Responsive enough to detect real trends

### Convergence Speed Examples

#### Fast Convergence (Model Actually Fast)
```
Start: avgLatencyMs = 1,500ms (degraded)
True performance: 800ms

Request 1:  1,500 × 0.8 + 800 × 0.2 = 1,360ms
Request 2:  1,360 × 0.8 + 800 × 0.2 = 1,248ms
Request 3:  1,248 × 0.8 + 800 × 0.2 = 1,158ms
Request 5:  1,053 × 0.8 + 800 × 0.2 = 1,002ms
Request 10: 886 × 0.8 + 800 × 0.2 = 869ms
Request 20: 818 × 0.8 + 800 × 0.2 = 814ms ← Near truth
Request 30: 805 × 0.8 + 800 × 0.2 = 804ms ← Stabilized

After ~30 requests: Fully recovered
```

#### Slow Convergence (Model Actually Slow)
```
Start: avgLatencyMs = 800ms (healthy)
True performance: 1,500ms

Request 1:  800 × 0.8 + 1,500 × 0.2 = 940ms
Request 2:  940 × 0.8 + 1,500 × 0.2 = 1,052ms
Request 3:  1,052 × 0.8 + 1,500 × 0.2 = 1,142ms
Request 5:  1,278 × 0.8 + 1,500 × 0.2 = 1,322ms
Request 10: 1,438 × 0.8 + 1,500 × 0.2 = 1,450ms
Request 20: 1,487 × 0.8 + 1,500 × 0.2 = 1,490ms ← Near truth
Request 30: 1,497 × 0.8 + 1,500 × 0.2 = 1,498ms ← Stabilized

After ~30 requests: Penalty fully applied
```

**Observation**: Convergence speed is symmetric (same ~30 requests up or down).

---

## When Automatic Recovery Doesn't Work

### Case 1: Model Completely Down
```
healthStatus: 'down'

Effect: Model excluded from candidates entirely
Code:
  const candidates = await prisma.llmModelRegistry.findMany({
    where: {
      healthStatus: { in: ['healthy', 'degraded'] } // ← 'down' excluded
    }
  })

Recovery: Requires admin to set healthStatus back to 'healthy' or 'degraded'
```

---

### Case 2: Model Disabled
```
enabled: false

Effect: Model excluded from candidates
Recovery: Requires admin to set enabled: true
```

---

### Case 3: Zero Traffic (Permanently Losing)
```
Scenario: Model is SO penalized that it literally never wins

Problem: If never selected, avgLatencyMs never updates
  → Penalty stays high forever
  → Catch-22 situation

Likelihood: Very rare (10-30% baseline traffic prevents this)

Manual Fix: Admin temporarily boosts priority to force traffic:
  await prisma.llmModelRegistry.update({
    where: { modelId: 'stuck-model' },
    data: { priority: 1 }
  })
```

**Mitigation Built-In**: The 10-30% baseline traffic from preferences/capabilities/fallbacks prevents zero-traffic scenarios.

---

## Comparison: Soft Penalties vs Hard Blocking

### Soft Penalty System (Current)

**Pros**:
- ✅ Self-healing without admin intervention
- ✅ Graceful degradation (gradual shift)
- ✅ Maintains backup capacity for rate limit overflows
- ✅ Continues monitoring for recovery
- ✅ Natural load balancing across providers

**Cons**:
- ⚠️ Some users still experience slow model during degradation
- ⚠️ Recovery takes time (~3-4 days with 10% traffic)
- ⚠️ Requires careful penalty tuning

---

### Hard Blocking Alternative (Not Implemented)

**How it would work**:
```typescript
if (model.avgLatencyMs > model.latencyBudgetMs * 1.5) {
  // Completely exclude model
  return null
}
```

**Pros**:
- ✅ No users experience slow model
- ✅ Clear on/off behavior (easier to understand)

**Cons**:
- ❌ Requires admin intervention to re-enable
- ❌ No automatic recovery
- ❌ Sudden capacity loss (not gradual)
- ❌ Can't use slow model even when it's only option
- ❌ No monitoring of recovery until manually re-enabled

**Why soft penalties chosen**: Better for production resilience and self-healing systems.

---

## Monitoring & Admin Tools

### Check Model Latency Trends
```sql
SELECT 
  DATE(createdAt) as date,
  selectedModelId,
  AVG(latencyMs) as avg_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latencyMs) as p95_latency,
  COUNT(*) as requests
FROM llm_gateway_logs
WHERE createdAt > NOW() - INTERVAL 7 DAYS
GROUP BY DATE(createdAt), selectedModelId
ORDER BY date DESC, requests DESC
```

---

### Identify Degraded Models
```sql
SELECT 
  m.modelId,
  m.avgLatencyMs,
  m.latencyBudgetMs,
  (m.avgLatencyMs - m.latencyBudgetMs) as overage,
  ROUND((m.avgLatencyMs - m.latencyBudgetMs) / 1000.0 * 0.001, 6) as penalty,
  COUNT(l.id) as last_24h_requests
FROM llm_model_registry m
LEFT JOIN llm_gateway_logs l ON l.selectedModelId = m.modelId 
  AND l.createdAt > NOW() - INTERVAL 1 DAY
WHERE m.enabled = true
GROUP BY m.id
HAVING overage > 0
ORDER BY penalty DESC
```

---

### Force Recovery Test
```typescript
// Temporarily boost priority to increase traffic for faster convergence
await prisma.llmModelRegistry.update({
  where: { modelId: 'recovering-model' },
  data: { priority: 1 } // Force highest priority
})

// Wait 1-2 hours for more traffic
// Check if avgLatencyMs improved

// If recovered, restore normal priority
await prisma.llmModelRegistry.update({
  where: { modelId: 'recovering-model' },
  data: { priority: 5 } // Back to normal
})
```

---

## Key Takeaways

1. **Penalties are gradients, not gates**
   - Models become less likely, not impossible, to be chosen
   
2. **Continuous monitoring is essential**
   - All models stay "warm" with 10-30% baseline traffic
   
3. **Self-healing is automatic**
   - Rolling average adapts to true performance over ~30 requests
   
4. **Recovery time depends on traffic**
   - More traffic = faster convergence
   - 10% traffic = ~3-4 days recovery
   - 50% traffic = ~1-2 days recovery
   
5. **System balances multiple goals**
   - Cost optimization
   - User experience (latency)
   - Reliability (failover capacity)
   - Automatic adaptation

6. **Admin controls are available but optional**
   - Priority adjustments (manual override)
   - enabled flag (complete disable)
   - healthStatus (temporary exclusion)

---

## Related Documentation

- [LLM Gateway Routing Algorithm](./llm-gateway-routing.md) - Main routing logic
- Model Registry: `server/utils/llm/modelRegistry.ts`
- Routing Engine: `server/utils/llm/routing.ts`
- Database Schema: `server/prisma/schema.prisma` (LlmModelRegistry)
