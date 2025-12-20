// server/api/llm-usage.get.ts
import { defineEventHandler, getQuery } from "h3";

import { requireRole } from "../middleware/_auth";

// Helpers
const usdFromMicros = (micros: bigint | number | null | undefined) => {
  const n = typeof micros === "bigint" ? Number(micros) : Number(micros ?? 0);
  return n / 1_000_000;
};

const monthKeyUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  // Query params
  const q = getQuery(event) as Record<string, string | undefined>;
  const startParam = q.start; // ISO date like 2025-08-01
  const endParam = q.end; // ISO date like 2025-08-31
  const limitParam = q.limit; // for top lists

  const now = new Date();
  const start = startParam
    ? new Date(startParam)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = endParam ? new Date(endParam) : now;
  const limit = Math.max(1, Math.min(100, Number(limitParam ?? 10)));

  // Fetch rows in range
  const rows = await prisma.llmUsage.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      userId: user.id,
    },
    orderBy: { createdAt: "desc" },
    take: 10000, // safety limit
  });

  // Aggregations
  let totalCalls = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalUsdMicros = 0n;
  let totalChars = 0;

  const byMonth: Record<
    string,
    { usdMicros: bigint; calls: number; tokens: number }
  > = {};
  const byFeature: Record<
    string,
    { usdMicros: bigint; calls: number; tokens: number }
  > = {};
  const byUser: Record<
    string,
    { usdMicros: bigint; calls: number; tokens: number }
  > = {};

  for (const r of rows) {
    totalCalls += 1;
    totalPromptTokens += r.promptTokens || 0;
    totalCompletionTokens += r.completionTokens || 0;
    totalUsdMicros += BigInt(r.totalUsdMicros || 0);

    const meta: any = r.meta || {};
    const inputChars = Number(meta?.inputChars ?? 0);
    const outputChars = Number(meta?.outputChars ?? 0);
    totalChars += inputChars + outputChars;

    // month
    const mk = monthKeyUTC(new Date(r.createdAt));
    if (!byMonth[mk]) byMonth[mk] = { usdMicros: 0n, calls: 0, tokens: 0 };
    byMonth[mk].usdMicros += BigInt(r.totalUsdMicros || 0);
    byMonth[mk].calls += 1;
    byMonth[mk].tokens += r.totalTokens || 0;

    // feature
    const fk = r.feature || "unknown";
    if (!byFeature[fk]) byFeature[fk] = { usdMicros: 0n, calls: 0, tokens: 0 };
    byFeature[fk].usdMicros += BigInt(r.totalUsdMicros || 0);
    byFeature[fk].calls += 1;
    byFeature[fk].tokens += r.totalTokens || 0;

    // user
    const uk = r.userId || "anonymous";
    if (!byUser[uk]) byUser[uk] = { usdMicros: 0n, calls: 0, tokens: 0 };
    byUser[uk].usdMicros += BigInt(r.totalUsdMicros || 0);
    byUser[uk].calls += 1;
    byUser[uk].tokens += r.totalTokens || 0;
  }

  const toArray = <
    T extends { usdMicros: bigint; calls: number; tokens: number },
  >(
    obj: Record<string, T>
  ) =>
    Object.entries(obj)
      .map(([key, v]) => ({
        key,
        usd: usdFromMicros(v.usdMicros),
        calls: v.calls,
        tokens: v.tokens,
      }))
      .sort((a, b) => b.usd - a.usd);

  const monthly = toArray(byMonth);
  const features = toArray(byFeature).slice(0, limit);
  const users = toArray(byUser).slice(0, limit);

  const totalTokens = totalPromptTokens + totalCompletionTokens;
  const tokensPer1kChars =
    totalChars > 0 ? totalTokens / (totalChars / 1000) : null;

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    totals: {
      calls: totalCalls,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      tokens: totalTokens,
      usd: usdFromMicros(totalUsdMicros),
      chars: totalChars,
      tokensPer1kChars,
    },
    byMonth: monthly,
    topFeatures: features,
    topUsers: users,
  };
});
