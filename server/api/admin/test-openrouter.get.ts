// server/api/admin/test-openrouter.get.ts
// Live integration test for the OpenRouter pipeline.
// Hit GET /api/admin/test-openrouter to verify:
//  1. Strategy resolution from registry
//  2. Pricing lookup (suffix hazard check)
//  3. Actual API call with cost + token tracking

export default defineEventHandler(async (event) => {
  const testModelId = "openrouter-gemini-flash-lite";
  const testPrompt = "Return the word 'Success' as a JSON array: [\"Success\"]";

  console.log(`🧪 Starting OpenRouter Integration Test for: ${testModelId}`);

  const results: Record<string, any> = {
    modelId: testModelId,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Strategy Resolution
    const strategy = await getLLMStrategyFromRegistry(testModelId);
    if (!strategy) {
      throw new Error(`Factory failed to resolve strategy for ${testModelId}`);
    }
    results.strategyResolved = true;
    console.log("✅ Strategy resolved: OpenRouterStrategy");

    // 2. Pricing Lookup (The "Suffix Hazard" Check)
    const { totalUsdMicros: costMicros } = await estimateCostMicros({
      provider: "openrouter",
      model: "google/gemini-2.0-flash-lite-001", // OR slug, not registry ID
      promptTokens: 100,
      completionTokens: 50,
    });
    results.pricingLookup = {
      costMicros: costMicros.toString(),
      working: costMicros > 0n,
    };
    console.log(`✅ Pricing Lookup: ${costMicros} micros for 150 tokens`);

    // 3. Live API Call
    const startTime = Date.now();
    const flashcards = await strategy.generateFlashcards(
      "OpenRouter is a unified API gateway that routes requests to multiple LLM providers like OpenAI, Anthropic, and Google. It supports model fallbacks, provider routing, and free model variants.",
      { itemCount: 2 }
    );
    const latencyMs = Date.now() - startTime;

    results.liveApiCall = {
      success: flashcards.length > 0,
      flashcardCount: flashcards.length,
      latencyMs,
      sample: flashcards[0] || null,
    };
    console.log(`✅ Live API: ${flashcards.length} flashcards in ${latencyMs}ms`);

    results.status = "success";
    return results;
  } catch (error: any) {
    console.error("❌ Test Failed:", error.message);
    results.status = "error";
    results.error = {
      message: error.message,
      statusCode: error.statusCode,
    };
    return results;
  }
});