export const translationPrompt = (
  word: string,
  context?: string,
  targetLang = "English",
  includeTranslation = true,
) => `
Analyze the word or phrase below for a vocabulary learning app. Respond ONLY with valid JSON, no prose.

Word: "${word}"
${context ? `Context: "${context}"` : ""}
Target language: ${targetLang}
Direct translation requested: ${includeTranslation ? "yes" : "no"}

JSON shape (exact):
{"translation":"${includeTranslation ? "best direct translation in target language" : ""}","partOfSpeech":"noun|verb|adjective|adverb|phrase|expression|unknown","detectedLang":"ISO-639-1 code","phonetic":"optional IPA or romanization","isPhrase":false,"category":"concise semantic category like food, travel, emotion, work, grammar","difficulty":"beginner|intermediate|advanced","meanings":[{"definition":"clear learner-friendly meaning","translation":"${includeTranslation ? "translation of this meaning in target language" : ""}","example":"short natural sentence using the word, only for single words when useful","partOfSpeech":"noun|verb|adjective|adverb|phrase|expression|unknown","category":"semantic category","register":"formal|neutral|informal|slang|technical"}],"examples":[{"text":"short natural example sentence","translation":"${includeTranslation ? "target-language translation of example" : ""}"}],"metadata":{"lemma":"base form when known","plural":"plural when useful","tense":"tense when useful","notes":"brief disambiguation or usage note"}}

Rules:
- Return 3 or 4 meanings when the item has multiple useful senses; otherwise return the strongest 1 or 2.
- If it is a phrase, set isPhrase true and skip forced single-word grammar details.
- If Direct translation requested is no, keep translation fields empty strings and still provide definitions/examples.
`;

export const languageStoryPrompt = (
  word: string,
  translation: string,
  context?: string,
  relatedWords: string[] = [],
  targetLanguage = "the source language",
  nativeLanguage = "the learner's native language",
) => `
You are a language learning assistant. Create exactly 3 short, natural sentences forming a coherent micro-story or dialog.

Requirements:
- The word "${word}" (meaning: ${translation}) MUST appear in one sentence as the PRIMARY cloze word
- ${
  relatedWords.length > 0
    ? `You may naturally incorporate these same-category saved words only if they fit the story: ${relatedWords.join(", ")}`
    : "Do not force extra saved words. Use simple common vocabulary for the other sentences."
}
- Sentences should flow as a connected story, not random statements
- Keep sentences simple (max 15 words each)
- The story should be memorable, slightly vivid or surprising
- Write the story in ${targetLanguage}
- Provide a natural translation of the full story in ${nativeLanguage}
- ${context ? `Draw inspiration from this context: "${context}"` : "Use an everyday scenario"}
- Do not include raw [[CLOZE:...]] markers in storyText or sentence text
- clozeBlank must be the full sentence with the cloze word replaced by "____"

Respond ONLY with valid minified JSON:
{"title":"Short title","storyText":"Full story as one paragraph.","nativeTranslation":"Full-story translation.","sentences":[{"text":"Full sentence with word.","clozeWord":"word","clozeBlank":"Sentence with ____ instead of word.","clozeIndex":0},{"text":"Full sentence 2.","clozeWord":"word2","clozeBlank":"Sentence 2 with ____.","clozeIndex":1},{"text":"Full sentence 3.","clozeWord":"word3","clozeBlank":"Sentence 3 with ____.","clozeIndex":2}],"glossary":[{"word":"${word}","translation":"${translation}"}],"ttsText":"Text to read aloud"}
`;
