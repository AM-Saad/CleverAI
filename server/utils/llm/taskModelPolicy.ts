import type { RoutingContext } from "./routing";

export type LlmTask = RoutingContext["task"];
export type LlmCapability = NonNullable<RoutingContext["requiredCapability"]>;

const IMPLEMENTED_PROVIDERS = [
  "openai",
  "google",
  "deepseek",
  "groq",
  "openrouter",
] as const;

export type ImplementedProvider = (typeof IMPLEMENTED_PROVIDERS)[number];

export interface LlmTaskModelPolicy {
  estimatedOutputTokens: number;
  requiredCapability?: LlmCapability;
  providerAllowlist: readonly ImplementedProvider[];
}

export const LLM_TASK_MODEL_POLICIES: Record<LlmTask, LlmTaskModelPolicy> = {
  flashcards: {
    estimatedOutputTokens: 500,
    requiredCapability: "text",
    providerAllowlist: IMPLEMENTED_PROVIDERS,
  },
  quiz: {
    estimatedOutputTokens: 800,
    requiredCapability: "text",
    providerAllowlist: IMPLEMENTED_PROVIDERS,
  },
  chat: {
    estimatedOutputTokens: 800,
    requiredCapability: "text",
    providerAllowlist: IMPLEMENTED_PROVIDERS,
  },
  language_translate: {
    estimatedOutputTokens: 450,
    requiredCapability: "text",
    providerAllowlist: IMPLEMENTED_PROVIDERS,
  },
  language_story: {
    estimatedOutputTokens: 300,
    requiredCapability: "text",
    providerAllowlist: IMPLEMENTED_PROVIDERS,
  },
};

const DEFAULT_POLICY: LlmTaskModelPolicy = {
  estimatedOutputTokens: 400,
  requiredCapability: "text",
  providerAllowlist: IMPLEMENTED_PROVIDERS,
};

export function getTaskModelPolicy(task: string): LlmTaskModelPolicy {
  return LLM_TASK_MODEL_POLICIES[task as LlmTask] ?? DEFAULT_POLICY;
}

export function getDevLlmModelOverride(config: unknown): string | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;

  const value = (config as { devLlmModelOverride?: unknown }).devLlmModelOverride;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

