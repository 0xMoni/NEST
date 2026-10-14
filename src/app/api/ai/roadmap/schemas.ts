import { z } from "zod";

export const RoadmapPhaseSchema = z.object({
  title: z.string(),
  duration: z.string(),
  objectives: z.array(z.string()),
  skills: z.array(z.string()),
  topics: z.array(z.string()),
  projects: z.array(z.string()),
  resources: z.array(z.string()),
  milestones: z.array(z.string()),
});

export const RoadmapResponseSchema = z.object({
  career_goal: z.string(),
  current_level: z.string(),
  estimated_duration: z.string(),
  summary: z.string(),
  phases: z.array(RoadmapPhaseSchema),
  missing_skills: z.array(z.string()),
  recommended_projects: z.array(z.string()),
  next_steps: z.array(z.string()),
});



// ... Keep existing RoadmapResponseSchema ...

export const QuizQuestionSchema = z.object({
  id: z.number(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correct_answer_index: z.number().int().min(0).max(3),
  explanation: z.string(),
});

export const QuizResponseSchema = z.object({
  title: z.string(),
  topic: z.string(),
  difficulty: z.string(),
  questions: z.array(QuizQuestionSchema).min(1),
});


export type QuizData = z.infer<typeof QuizResponseSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export type RoadmapResponse = z.infer<typeof RoadmapResponseSchema>;