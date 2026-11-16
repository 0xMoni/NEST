import { z } from "zod";

export const MetricScoreSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
});

export const StrongPointSchema = z.object({
  title: z.string(),
  description: z.string(),
  tag: z.string(),
});

export const WeakPointSchema = z.object({
  title: z.string(),
  description: z.string(),
  impact_level: z.enum(["High", "Medium", "Low"]),
});

export const LoopholeSchema = z.object({
  loophole: z.string(),
  why_it_matters: z.string(),
  how_to_fix: z.string(),
});

export const ImprovementAreaSchema = z.object({
  section: z.string(),
  critique: z.string(),
  action_plan: z.string(),
});

export const WordReplacementSchema = z.object({
  weak_word: z.string(),
  powerful_replacement: z.string(),
  usage_example: z.string(),
});

export const BulletRewriteSchema = z.object({
  original_bullet: z.string(),
  rewritten_bullet: z.string(),
  formula_applied: z.string(),
  why_it_wins: z.string(),
});

export const PackagePredictionSchema = z.object({
  current_bracket: z.string(),
  current_tier: z.string(),
  current_rationale: z.string(),
  potential_bracket: z.string(),
  potential_tier: z.string(),
  unlock_requirements: z.array(z.string()),
});

export const BenchmarkComparisonItemSchema = z.object({
  aspect: z.string(),
  your_resume: z.string(),
  top_1_percent_standard: z.string(),
  gap_severity: z.enum(["Critical", "Moderate", "Minor", "Good"]),
});

export const ResumeReviewResponseSchema = z.object({
  candidate_name: z.string().default("Candidate"),
  target_role: z.string().default("Software Engineer"),
  overall_score: z.number().min(0).max(100),
  score_badge: z.string(),
  summary_critique: z.string(),
  metrics: z.object({
    ats_formatting: MetricScoreSchema,
    content_impact: MetricScoreSchema,
    keyword_depth: MetricScoreSchema,
    quantified_results: MetricScoreSchema,
  }),
  package_prediction: PackagePredictionSchema,
  strong_points: z.array(StrongPointSchema),
  weak_points: z.array(WeakPointSchema),
  loopholes: z.array(LoopholeSchema),
  improvement_areas: z.array(ImprovementAreaSchema),
  word_analysis: z.object({
    overused_buzzwords: z.array(z.string()),
    power_replacements: z.array(WordReplacementSchema),
    bullet_rewrites: z.array(BulletRewriteSchema),
  }),
  market_comparison: z.array(BenchmarkComparisonItemSchema),
  action_checklist: z.array(z.string()),
  motivation_boost: z.string(),
});

export type ResumeReviewData = z.infer<typeof ResumeReviewResponseSchema>;
