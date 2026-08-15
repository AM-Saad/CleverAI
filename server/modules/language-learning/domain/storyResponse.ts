import {
  LanguageSentenceSchema,
  type LanguageSentence,
} from "../../../../shared/utils/language.contract";
import { stripJsonCodeFence } from "./lexicalEntry";
import {
  isValidLanguageCloze,
  selectPrimaryLanguageCloze,
} from "../../../../shared/utils/language-review-card";
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
  sentences: z
    .array(LanguageSentenceSchema)
    .length(3)
    .refine(
      (sentences) =>
        sentences.every(
          (sentence) =>
            isValidLanguageCloze(sentence) &&
            !sentence.text.includes("[[CLOZE:") &&
            !sentence.clozeBlank.includes("[[CLOZE:"),
        ),
      "Every story sentence needs one clean cloze blank",
    ),
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
  expectedWord?: string,
): ParsedLanguageStory {
  const parsed = StoryResponseSchema.parse(
    JSON.parse(extractJsonObject(rawText)),
  );

  const storyText =
    parsed.storyText?.trim() ||
    parsed.sentences.map((sentence) => sentence.text).join(" ");
  if (storyText.includes("[[CLOZE:")) {
    throw new Error("Story response contains raw cloze markers");
  }

  const primary = expectedWord
    ? selectPrimaryLanguageCloze(parsed.sentences, expectedWord)
    : null;
  if (expectedWord && !primary) {
    throw new Error(
      "Story response has no valid primary cloze for captured word",
    );
  }
  const primaryIndex = primary
    ? parsed.sentences.findIndex(
        (sentence) =>
          sentence.clozeIndex === primary.clozeIndex &&
          sentence.clozeWord === primary.clozeWord &&
          sentence.text === primary.text,
      )
    : -1;
  const sentences = primary
    ? parsed.sentences.map((sentence, index) => ({
        ...sentence,
        isPrimary: index === primaryIndex,
      }))
    : parsed.sentences;

  return {
    ...parsed,
    storyText,
    sentences,
  };
}
