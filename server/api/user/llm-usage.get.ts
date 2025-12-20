import { requireRole } from "~~/server/middleware/_auth";

export default defineEventHandler(async (event) => {
  try {
    // Check for authenticated session with safe handling
    const user = await requireRole(event, ["USER"]);

    // Get Prisma client from context
    const prisma = event.context.prisma;

    // Helper function to convert micros to USD
    const usdFromMicros = (micros: bigint | number | null | undefined) => {
      const n =
        typeof micros === "bigint" ? Number(micros) : Number(micros ?? 0);
      return parseFloat((n / 1_000_000).toFixed(6)); // Format to 6 decimal places
    };

    // Allow optional from/to query params (YYYY-MM-DD). Fallback to last 30 days.
    const query = getQuery(event) as Record<string, string | undefined>;
    const now = new Date();
    let fromDate: Date;
    let toDate: Date;

    // Parse `from`
    if (query.from) {
      const parsed = new Date(query.from);
      fromDate = isNaN(parsed.getTime())
        ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        : parsed;
    } else {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Parse `to` and normalize to end-of-day so the entire `to` date is included
    if (query.to) {
      const parsedTo = new Date(query.to);
      toDate = isNaN(parsedTo.getTime()) ? now : parsedTo;
    } else {
      toDate = now;
    }
    toDate.setHours(23, 59, 59, 999);

    // Safety: if fromDate > toDate, set fromDate to 30 days before toDate
    if (fromDate > toDate) {
      fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Clamp maximum window to 365 days to avoid huge queries
    const maxWindowMs = 365 * 24 * 60 * 60 * 1000;
    if (toDate.getTime() - fromDate.getTime() > maxWindowMs) {
      fromDate = new Date(toDate.getTime() - maxWindowMs);
    }

    // Get LLM usage stats for the user
    const usageStats = await prisma.llmUsage.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate totals
    const totalCalls = usageStats.length;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalUsdMicros = BigInt(0);

    // Group by feature and model
    const byFeature: Record<
      string,
      { calls: number; tokens: number; usdMicros: bigint }
    > = {};
    const byModel: Record<
      string,
      { calls: number; tokens: number; usdMicros: bigint }
    > = {};

    // Group by day for the chart
    const byDay: Record<
      string,
      { date: string; calls: number; tokens: number; usd: number }
    > = {};

    // Process each usage record
    for (const usage of usageStats) {
      totalPromptTokens += usage.promptTokens || 0;
      totalCompletionTokens += usage.completionTokens || 0;
      totalTokens += usage.totalTokens || 0;
      totalUsdMicros += usage.totalUsdMicros || BigInt(0);

      // Group by feature
      const feature = usage.feature || "unknown";
      if (!byFeature[feature]) {
        byFeature[feature] = { calls: 0, tokens: 0, usdMicros: BigInt(0) };
      }
      byFeature[feature].calls += 1;
      byFeature[feature].tokens += usage.totalTokens || 0;
      byFeature[feature].usdMicros += usage.totalUsdMicros || BigInt(0);

      // Group by model
      const model = usage.model || "unknown";
      if (!byModel[model]) {
        byModel[model] = { calls: 0, tokens: 0, usdMicros: BigInt(0) };
      }
      byModel[model].calls += 1;
      byModel[model].tokens += usage.totalTokens || 0;
      byModel[model].usdMicros += usage.totalUsdMicros || BigInt(0);

      // Group by day
      const dateStr = usage.createdAt.toISOString().split("T")[0];
      if (!byDay[dateStr]) {
        byDay[dateStr] = {
          date: dateStr,
          calls: 0,
          tokens: 0,
          usd: 0,
        };
      }
      byDay[dateStr].calls += 1;
      byDay[dateStr].tokens += usage.totalTokens || 0;
      byDay[dateStr].usd += usdFromMicros(usage.totalUsdMicros);
    }

    // Convert grouped data to arrays for the frontend
    const featuresArray = Object.entries(byFeature)
      .map(([name, stats]) => ({
        name,
        calls: stats.calls,
        tokens: stats.tokens,
        usd: usdFromMicros(stats.usdMicros),
      }))
      .sort((a, b) => b.usd - a.usd);

    const modelsArray = Object.entries(byModel)
      .map(([name, stats]) => ({
        name,
        calls: stats.calls,
        tokens: stats.tokens,
        usd: usdFromMicros(stats.usdMicros),
      }))
      .sort((a, b) => b.usd - a.usd);

    // Fill in missing dates for the chart
    const dailyUsage = [];
    const dateSet = new Set(Object.keys(byDay));

    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      if (dateSet.has(dateStr)) {
        dailyUsage.push(byDay[dateStr]);
      } else {
        dailyUsage.push({
          date: dateStr,
          calls: 0,
          tokens: 0,
          usd: 0,
        });
      }
    }

    // Recent usage history (last 10 entries)
    const recentUsage = usageStats.slice(0, 10).map((usage) => ({
      id: usage.id,
      date: usage.createdAt.toISOString(),
      feature: usage.feature || "unknown",
      model: usage.model,
      tokens: usage.totalTokens,
      usd: usdFromMicros(usage.totalUsdMicros),
    }));

    return {
      summary: {
        totalCalls,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        totalUsd: usdFromMicros(totalUsdMicros),
        periodStart: fromDate.toISOString(),
        periodEnd: toDate.toISOString(),
      },
      byFeature: featuresArray,
      byModel: modelsArray,
      dailyUsage,
      recentUsage,
    };
  } catch (error: unknown) {
    console.error("Error fetching user LLM usage:", error);
    setResponseStatus(event, 500);
    return {
      error: "Failed to fetch LLM usage data",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
