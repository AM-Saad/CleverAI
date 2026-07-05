import {
  LanguageSentenceSchema,
  type LanguageSentence,
} from "../../../../shared/utils/language.contract";
import { stripJsonCodeFence } from "./lexicalEntry";
import { z } from "zod";

export type ParsedLanguageStory = {
  title?: string;
  storyText: string;
  nativeTranslation?: string;
  sentences: LanguageSentence[];
  glossary?: Array<Record<string, string>>;
  ttsText?: string;
};

const StoryResponseSchema = z.object({
  title: z.string().optional(),
  storyText: z.string().optional(),
  nativeTranslation: z.string().optional(),
  sentences: z.array(LanguageSentenceSchema).min(1),
  glossary: z.array(z.record(z.string(), z.string())).optional(),
  ttsText: z.string().optional(),
});

const extractJsonObject = (rawText: string) => {
  const cleaned = rawText.trim();
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return cleaned.slice(startIdx, endIdx + 1);
  }
  return stripJsonCodeFence(cleaned);
};

export function parseLanguageStoryResponse(
  rawText: string,
): ParsedLanguageStory {
  const parsed = StoryResponseSchema.parse(
    JSON.parse(extractJsonObject(rawText)),
  );

  const storyText =
    parsed.storyText?.trim() ||
    parsed.sentences.map((sentence) => sentence.text).join(" ");

  return {
    ...parsed,
    storyText,
  };
}
