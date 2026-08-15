import {
  LanguageReviewModeSchema,
  LanguageSentenceSchema,
  type LanguageExample,
  type LanguageMeaning,
  type LanguageReviewMode,
  type LanguageReviewPresentation,
  type LanguageSentence,
} from "./language.contract";

export type LanguageReviewWordInput = {
  word: string;
  translation?: string | null;
  sourceLang?: string | null;
  translationLang?: string | null;
  partOfSpeech?: string | null;
  phonetic?: string | null;
  meanings?: unknown;
  examples?: unknown;
  sourceContext?: string | null;
};

export type LanguageReviewStoryInput = {
  storyText?: string | null;
  sentences?: unknown;
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeMatchText = (value: string) =>
  value.normalize("NFC").trim().toLowerCase();

const normalizeSentenceText = (value: string) =>
  normalizeMatchText(value).replace(/\s+/g, " ");

export const isValidLanguageCloze = (sentence: LanguageSentence) => {
  if ((sentence.clozeBlank.match(/____/g) ?? []).length !== 1) return false;
  return (
    normalizeSentenceText(
      sentence.clozeBlank.replace("____", sentence.clozeWord),
    ) === normalizeSentenceText(sentence.text)
  );
};

const meaningsFrom = (value: unknown): LanguageMeaning[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const definition = text(item.definition);
      if (!definition) return null;
      return {
        definition,
        ...(text(item.translation)
          ? { translation: text(item.translation) }
          : {}),
        ...(text(item.example) ? { example: text(item.example) } : {}),
        ...(text(item.partOfSpeech)
          ? { partOfSpeech: text(item.partOfSpeech) }
          : {}),
        ...(text(item.category) ? { category: text(item.category) } : {}),
        ...(text(item.register) ? { register: text(item.register) } : {}),
      } satisfies LanguageMeaning;
    })
    .filter((entry): entry is LanguageMeaning => entry !== null);
};

const examplesFrom = (value: unknown): LanguageExample[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const sourceText = text(item.text);
      if (!sourceText) return null;
      return {
        text: sourceText,
        ...(text(item.translation)
          ? { translation: text(item.translation) }
          : {}),
      } satisfies LanguageExample;
    })
    .filter((entry): entry is LanguageExample => entry !== null);
};

const safePromptContext = (sourceContext: string, answer: string) => {
  if (!sourceContext) return null;
  const normalizedAnswer = normalizeSentenceText(answer);
  return normalizedAnswer &&
    normalizeSentenceText(sourceContext).includes(normalizedAnswer)
    ? null
    : sourceContext;
};

export const selectPrimaryLanguageCloze = (
  sentencesValue: unknown,
  word: string,
): LanguageSentence | null => {
  const parsed = LanguageSentenceSchema.array().safeParse(sentencesValue);
  if (!parsed.success) return null;
  const candidates = parsed.data.filter(
    (sentence) =>
      sentence.text.trim() &&
      sentence.clozeWord.trim() &&
      isValidLanguageCloze(sentence),
  );
  if (!candidates.length) return null;

  const normalizedWord = normalizeMatchText(word);
  return (
    candidates.find(
      (sentence) =>
        sentence.isPrimary === true &&
        normalizeMatchText(sentence.clozeWord) === normalizedWord,
    ) ??
    candidates.find(
      (sentence) => normalizeMatchText(sentence.clozeWord) === normalizedWord,
    ) ??
    null
  );
};

export const reviewModeForLanguageWord = (
  word: LanguageReviewWordInput,
): Exclude<LanguageReviewMode, "story_cloze"> | null => {
  if (text(word.translation)) return "word_translation";
  if (meaningsFrom(word.meanings)[0]?.definition) return "word_definition";
  return null;
};

export function buildLanguageReviewPresentation(input: {
  word: LanguageReviewWordInput;
  story?: LanguageReviewStoryInput | null;
  preferredMode?: string | null;
}): {
  mode: LanguageReviewMode;
  presentation: LanguageReviewPresentation;
} | null {
  const wordText = text(input.word.word);
  if (!wordText) return null;

  const translation = text(input.word.translation);
  const sourceLang = text(input.word.sourceLang) || "auto";
  const translationLang = text(input.word.translationLang) || "en";
  const meanings = meaningsFrom(input.word.meanings);
  const examples = examplesFrom(input.word.examples);
  const primaryMeaning = meanings[0] ?? null;
  const primaryExample = examples[0] ?? null;
  const primaryExampleText =
    (primaryExample?.text ?? text(primaryMeaning?.example)) || null;
  const cloze = input.story
    ? selectPrimaryLanguageCloze(input.story.sentences, wordText)
    : null;
  const preferred = LanguageReviewModeSchema.safeParse(input.preferredMode);

  let mode: LanguageReviewMode | null = null;
  if (preferred.success) {
    if (preferred.data === "story_cloze" && cloze) mode = "story_cloze";
    if (preferred.data === "word_translation" && translation)
      mode = "word_translation";
    if (preferred.data === "word_definition" && primaryMeaning?.definition)
      mode = "word_definition";
  }
  if (!mode && cloze) mode = "story_cloze";
  if (!mode) mode = reviewModeForLanguageWord(input.word);
  if (!mode) return null;

  const common = {
    audioText: wordText,
    phonetic: text(input.word.phonetic) || null,
    partOfSpeech:
      text(input.word.partOfSpeech) &&
      text(input.word.partOfSpeech) !== "unknown"
        ? text(input.word.partOfSpeech)
        : null,
    sourceContext: text(input.word.sourceContext) || null,
  };

  if (mode === "story_cloze" && cloze) {
    return {
      mode,
      presentation: {
        ...common,
        question: cloze.clozeBlank,
        answer: wordText,
        questionLang: sourceLang,
        answerLang: sourceLang,
        translation: translation || null,
        definition: primaryMeaning?.definition ?? null,
        context: {
          label: "Complete sentence",
          text: cloze.text,
        },
        promptContext: null,
        storyText: text(input.story?.storyText) || null,
      },
    };
  }

  if (mode === "word_definition" && primaryMeaning) {
    return {
      mode,
      presentation: {
        ...common,
        question: wordText,
        answer: primaryMeaning.definition,
        questionLang: sourceLang,
        answerLang: sourceLang,
        translation: null,
        definition: null,
        context: primaryExampleText
          ? {
              label: "Example",
              text: primaryExampleText,
              translation: primaryExample?.translation ?? null,
            }
          : null,
        promptContext: safePromptContext(
          common.sourceContext ?? "",
          primaryMeaning.definition,
        ),
        storyText: null,
      },
    };
  }

  if (!translation) return null;
  return {
    mode: "word_translation",
    presentation: {
      ...common,
      question: wordText,
      answer: translation,
      questionLang: sourceLang,
      answerLang: translationLang,
      translation: null,
      definition: primaryMeaning?.definition ?? null,
      context: primaryExampleText
        ? {
            label: "Example",
            text: primaryExampleText,
            translation: primaryExample?.translation ?? null,
          }
        : null,
      promptContext: safePromptContext(common.sourceContext ?? "", translation),
      storyText: null,
    },
  };
}
