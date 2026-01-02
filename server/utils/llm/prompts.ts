/**
 * Generate flashcard creation prompt with adaptive item count
 *
 * @param text - Source text to generate flashcards from
 * @param itemCount - Number of flashcards to generate
 */
export const flashcardPrompt = (text: string, itemCount: number = 5) => `
Create exactly ${itemCount} flashcards from the following content.
Each flashcard MUST have:
- "front": the question/term
- "back": the answer/definition

Content:
"""
${text}
"""

Respond ONLY with minified JSON (no prose), as an array with this exact shape:
[
  { "front": "Question text...", "back": "Answer text..." }
]
`;

/**
 * Generate quiz question creation prompt with adaptive item count
 *
 * @param text - Source text to generate questions from
 * @param itemCount - Number of quiz questions to generate
 */
export const quizPrompt = (text: string, itemCount: number = 3) => `
Generate exactly ${itemCount} multiple choice questions from the following content.
Rules:
1. Respond ONLY with valid minified JSON (no code fences, no prose, no explanations).
2. Each object must have exactly:
   - "question": string
   - "choices": array of exactly 4 distinct strings
   - "answerIndex": integer (0..3) indicating the correct choice.
3. Do not include any extra fields or text outside the JSON array.

Content:
"""
${text}
"""

Expected output format:
[{"question":"...","choices":["...","...","...","..."],"answerIndex":0}]
`;

