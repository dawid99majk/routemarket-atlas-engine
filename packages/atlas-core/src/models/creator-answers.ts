import { z } from "zod";

export const CreatorAnswerSchema = z.object({
  questionId: z.string(),
  question: z.string(),
  answer: z.string(),
  answeredAt: z.string()
});

export const CreatorAnswersSchema = z.object({
  projectId: z.string(),
  updatedAt: z.string(),
  answers: z.array(CreatorAnswerSchema)
});

export type CreatorAnswer = z.infer<typeof CreatorAnswerSchema>;
export type CreatorAnswers = z.infer<typeof CreatorAnswersSchema>;
