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

export type RoadmapResponse = z.infer<typeof RoadmapResponseSchema>;