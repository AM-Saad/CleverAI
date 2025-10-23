// server/utils/llm/LLMStrategy.ts
// Strategy contracts should return plain DTOs, not Prisma entities.

// export interface FlashcardDTO {
//   front: string;
//   back: string;
// }

// export interface QuizQuestionDTO {
//   question: string;
//   choices: string[];
//   answerIndex: number;
// }

export interface LLMStrategy {
  generateFlashcards(input: string): Promise<FlashcardDTO[]>;
  generateQuiz(input: string): Promise<QuizQuestionDTO[]>;
}
