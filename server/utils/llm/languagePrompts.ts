export const translationPrompt = (
  word: string,
  context?: string,
  targetLang = "English"
) => `
Translate the word or phrase below. Respond ONLY with valid JSON, no prose.

Word: "${word}"
${context ? `Context: "${context}"` : ""}
Target language: ${targetLang}

JSON shape (exact):
{"translation":"...","partOfSpeech":"noun|verb|adjective|adverb|phrase","detectedLang":"ISO-639-1 code","phonetic":"optional IPA or romanization"}
`;

export const languageStoryPrompt = (
  word: string,
  translation: string,
  context?: string,
  relatedWords: string[] = []
) => `
You are a language learning assistant. Create exactly 3 short, natural sentences forming a coherent micro-story.

Requirements:
- The word "${word}" (meaning: ${translation}) MUST appear in one sentence as the PRIMARY cloze word
- Each sentence must use ONE cloze word marked with [[CLOZE:word]]
- ${relatedWords.length > 0
    ? `Try to naturally incorporate these related words as cloze targets in the other sentences: ${relatedWords.join(", ")}`
    : "The other two sentences should use common, useful vocabulary as cloze targets"
  }
- Sentences should flow as a connected story, not random statements
- Keep sentences simple (max 15 words each)
- The story should be memorable, slightly vivid or surprising
- ${context ? `Draw inspiration from this context: "${context}"` : "Use an everyday scenario"}

Respond ONLY with valid minified JSON:
{"storyText":"Full story as one paragraph.","sentences":[{"text":"Full sentence with word.","clozeWord":"word","clozeBlank":"Sentence with ____ instead of word.","clozeIndex":0},{"text":"Full sentence 2.","clozeWord":"word2","clozeBlank":"Sentence 2 with ____.","clozeIndex":1},{"text":"Full sentence 3.","clozeWord":"word3","clozeBlank":"Sentence 3 with ____.","clozeIndex":2}]}
`;
