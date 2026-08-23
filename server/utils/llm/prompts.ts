/**
 * Generate flashcard creation prompt with adaptive item count
 *
 * @param text - Source text to generate flashcards from (may contain [[BLOCK_ID:xyz]] or [[PAGE:n]] markers)
 * @param itemCount - Number of flashcards to generate
 */
export const flashcardPrompt = (text: string, itemCount: number = 5) => `
Create exactly ${itemCount} flashcards from the following content.
Learning-quality rules:
- Test active recall, not recognition. Use a clear question or completion prompt.
- Keep each card atomic: one concept and one unambiguous answer.
- Make the answer concise but sufficient to stand alone.
- Use only claims directly supported by the source. Never add outside facts.
- Cover distinct, important concepts. Do not create duplicate or near-duplicate cards.
- Preserve the source language unless translation is explicitly requested.

Each flashcard MUST have:
- "front": the question/term
- "back": the answer/definition
- "source_metadata": REQUIRED object with "anchor" field
  - If the source text contains [[BLOCK_ID:xyz]], use that ID as the anchor
  - If the source text contains [[PAGE:n]], use the page number as the anchor
  - "context_snippet": REQUIRED short, exact source quote supporting the answer

Content:
"""
${text}
"""

Respond ONLY with minified JSON (no prose), as an object with this exact shape:
{"items":[
  { 
    "front": "Question text...", 
    "back": "Answer text...",
    "source_metadata": { "anchor": "block-123", "context_snippet": "Exact supporting source text" }
  }
]}
`;

/**
 * Generate quiz question creation prompt with adaptive item count
 *
 * @param text - Source text to generate questions from (may contain [[BLOCK_ID:xyz]] or [[PAGE:n]] markers)
 * @param itemCount - Number of quiz questions to generate
 */
export const quizPrompt = (text: string, itemCount: number = 3) => `
Generate exactly ${itemCount} multiple choice questions from the following content.
Rules:
1. Respond ONLY with valid minified JSON (no code fences, no prose, no explanations).
2. Each object must have exactly:
   - "question": string
   - "choices": array of exactly 4 distinct strings
   - "answerIndex": integer (0..3) indicating the correct choice
	   - "source_metadata": REQUIRED object with "anchor" field
	     - If the source text contains [[BLOCK_ID:xyz]], use that ID as the anchor
	     - If the source text contains [[PAGE:n]], use the page number as the anchor
	     - "context_snippet": REQUIRED short, exact source quote supporting the answer
3. Test one important concept per question. Cover distinct concepts across the set.
4. Use one unambiguously correct answer supported directly by the source.
5. Make distractors plausible, mutually distinct, and the same category/granularity as the answer.
6. Never use "all of the above", "none of the above", trick wording, or outside facts.
7. Preserve the source language unless translation is explicitly requested.
8. Do not include any extra fields or text outside the JSON object.

Content:
"""
${text}
"""

Expected output format:
{"items":[{"question":"...","choices":["...","...","...","..."],"answerIndex":0,"source_metadata":{"anchor":"block-123","context_snippet":"Exact supporting source text"}}]}
`;
