import type { LanguageSentence } from "@shared/utils/language.contract";
import { stripJsonCodeFence } from "./lexicalEntry";

export type ParsedLanguageStory = {
  title?: string;
  storyText: string;
  nativeTranslation?: string;
  sentences: LanguageSentence[];
  glossary?: Array<Record<string, string>>;
  ttsText?: string;
};

export function parseLanguageStoryResponse(rawText: string): ParsedLanguageStory {
  const parsed = JSON.parse(stripJsonCodeFence(rawText)) as ParsedLanguageStory;

  if (!parsed.storyText || !Array.isArray(parsed.sentences)) {
    throw new Error("Story response missing required fields");
  }

  return parsed;
}
