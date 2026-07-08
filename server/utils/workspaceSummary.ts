import type { Prisma } from "@prisma/client";

export const workspaceSummarySelect = {
  id: true,
  title: true,
  description: true,
  metadata: true,
  order: true,
  llmModel: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkspaceSelect;

export function measureWorkspacePayload(payload: unknown) {
  const start = performance.now();
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  return {
    bytes,
    ms: performance.now() - start,
  };
}

export function logWorkspaceEndpointTiming(input: {
  route: string;
  authMs: number;
  prismaMs: number;
  serializeMs: number;
  payloadBytes: number;
}) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[workspace:perf]", input.route, {
    authMs: Math.round(input.authMs),
    prismaMs: Math.round(input.prismaMs),
    serializeMs: Math.round(input.serializeMs),
    payloadBytes: input.payloadBytes,
  });
}
