import type {
  LanguageExample,
  LanguageMeaning,
} from "@shared/utils/language.contract";

export type ParsedLexicalEntry = {
  translation?: string;
  partOfSpeech?: string;
  detectedLang?: string;
  phonetic?: string;
  meanings?: LanguageMeaning[];
  examples?: LanguageExample[];
  category?: string;
  difficulty?: string;
  isPhrase?: boolean;
  metadata?: Record<string, unknown>;
};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeMeanings = (value: unknown): LanguageMeaning[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const definition = asString(source.definition);
      if (!definition) return null;
      const meaning: LanguageMeaning = { definition };
      const translation = asString(source.translation);
      const example = asString(source.example);
      const partOfSpeech = asString(source.partOfSpeech);
      const category = asString(source.category);
      const register = asString(source.register);
      if (translation) meaning.translation = translation;
      if (example) meaning.example = example;
      if (partOfSpeech) meaning.partOfSpeech = partOfSpeech;
      if (category) meaning.category = category;
      if (register) meaning.register = register;
      return meaning;
    })
    .filter((item): item is LanguageMeaning => item !== null)
    .slice(0, 4);
};

const normalizeExamples = (value: unknown): LanguageExample[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const text = asString(source.text);
      if (!text) return null;
      const example: LanguageExample = { text };
      const translation = asString(source.translation);
      if (translation) example.translation = translation;
      return example;
    })
    .filter((item): item is LanguageExample => item !== null)
    .slice(0, 3);
};

export const stripJsonCodeFence = (rawText: string) =>
  rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

export function parseLexicalEntry(rawText: string, fallbackWord: string) {
  let cleaned = rawText.trim();
  
  // Extract JSON block if it's wrapped in conversational text
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  } else {
    cleaned = stripJsonCodeFence(cleaned);
  }

  let parsed: ParsedLexicalEntry;
  try {
    parsed = JSON.parse(cleaned) as ParsedLexicalEntry;
  } catch (err) {
    console.error("[parseLexicalEntry] Failed to parse JSON. Raw text:", rawText);
    throw err;
  }

  const meanings = normalizeMeanings(parsed.meanings);
  const examples = normalizeExamples(parsed.examples);
  const translation =
    asString(parsed.translation) ||
    meanings.find((meaning) => meaning.translation)?.translation ||
    fallbackWord;

  return {
    translation,
    partOfSpeech: asString(parsed.partOfSpeech) || "unknown",
    detectedLang: asString(parsed.detectedLang) || "auto",
    phonetic: asString(parsed.phonetic) || undefined,
    meanings:
      meanings.length > 0
        ? meanings
        : [
            {
              definition: translation || fallbackWord,
              partOfSpeech: asString(parsed.partOfSpeech) || "unknown",
            },
          ],
    examples,
    category: asString(parsed.category) || meanings[0]?.category || undefined,
    difficulty: asString(parsed.difficulty) || undefined,
    isPhrase:
      typeof parsed.isPhrase === "boolean"
        ? parsed.isPhrase
        : fallbackWord.trim().split(/\s+/).length > 1,
    metadata:
      parsed.metadata && typeof parsed.metadata === "object"
        ? (parsed.metadata as Record<string, unknown>)
        : {},
  };
}
