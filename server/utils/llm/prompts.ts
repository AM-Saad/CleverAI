export const flashcardPrompt = (text: string) => `
Create 5 flashcards from the following content.
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

export const quizPrompt = (text: string) => `
Generate exactly 3 multiple choice questions from the following content.
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
