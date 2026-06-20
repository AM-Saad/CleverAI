const OPENROUTER_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-2.0-flash-lite-001": "google/gemini-2.5-flash-lite",
};

export function resolveOpenRouterModelName(modelName: string): string {
  if (OPENROUTER_MODEL_ALIASES[modelName]) {
    return OPENROUTER_MODEL_ALIASES[modelName];
  }

  const [baseModel, suffix] = modelName.split(":");
  const replacement = baseModel
    ? OPENROUTER_MODEL_ALIASES[baseModel]
    : undefined;
  if (!replacement) return modelName;

  // OpenRouter no longer exposes a Gemini Flash Lite free endpoint. Route old
  // free aliases to the live paid Lite model instead of sending a dead slug.
  return suffix && suffix !== "free" ? `${replacement}:${suffix}` : replacement;
}

