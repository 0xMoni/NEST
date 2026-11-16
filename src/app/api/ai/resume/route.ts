import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiClient } from "@/app/api/ai/roadmap/client";
import { RESUME_SYSTEM_PROMPTS } from "@/app/api/ai/resume/prompts";
import { ResumeReviewResponseSchema } from "@/app/api/ai/resume/schemas";
import { PDFParse } from "pdf-parse";

// We prefer gpt-oss-120b for high-caliber deep analysis, with fallback to gpt-oss-20b
const PRIMARY_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "openai/gpt-oss-20b";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ai = aiClient();
    if (!ai) {
      return NextResponse.json(
        { error: "The AI service is not configured yet. Check GROQ_API_KEY in .env.local" },
        { status: 503 }
      );
    }

    let resumeText = "";
    let targetRole = "Software Engineer / Tech Role";
    let candidateName = "";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("resume_file") as File | null;
      targetRole = (formData.get("target_role") as string) || targetRole;
      candidateName = (formData.get("candidate_name") as string) || candidateName;

      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          try {
            const parser = new PDFParse({ data: buffer });
            const parseRes = await parser.getText();
            resumeText = parseRes.text || "";
            await parser.destroy();
          } catch (pdfErr) {
            console.error("PDF parse error:", pdfErr);
            return NextResponse.json(
              { error: "Could not read this PDF. If it is password-protected or scanned, please paste the text directly." },
              { status: 400 }
            );
          }
        } else {
          // Assume text or markdown
          resumeText = buffer.toString("utf-8");
        }
      }

      // If text was also passed in form data as fallback
      const pasted = formData.get("resume_text") as string | null;
      if (!resumeText && pasted) {
        resumeText = pasted;
      }
    } else {
      // JSON body
      const body = await request.json();
      resumeText = body.resume_text || "";
      targetRole = body.target_role || targetRole;
      candidateName = body.candidate_name || candidateName;
    }

    // Clean text
    resumeText = resumeText.trim();

    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json(
        { error: "Please provide a more complete resume (at least 50 characters) to get an accurate ATS review." },
        { status: 400 }
      );
    }

    const prompt = `
Target Job / Specialization: ${targetRole}
${candidateName ? `Candidate Stated Name: ${candidateName}` : ""}

--- STUDENT RESUME CONTENT START ---
${resumeText.slice(0, 12000)}
--- STUDENT RESUME CONTENT END ---

Carefully analyze the resume above. Generate a JSON response that matches this structure exactly:
{
  "candidate_name": "Full Name extracted from resume or candidate",
  "target_role": "${targetRole}",
  "overall_score": 76,
  "score_badge": "Placement Ready / Emerging Contender / High Potential / Top 1% Material",
  "summary_critique": "A punchy, honest, 2-3 sentence executive recruiter verdict on the resume.",
  "metrics": {
    "ats_formatting": { "score": 85, "feedback": "Detailed observation on parsing, single vs multi-column, layout safety." },
    "content_impact": { "score": 70, "feedback": "Evaluation of whether descriptions convey genuine engineering depth." },
    "keyword_depth": { "score": 75, "feedback": "Check for foundational skills, frameworks, tools, and recruiter search keywords." },
    "quantified_results": { "score": 60, "feedback": "Check for numbers, scale, percentages, latency reduction, user counts." }
  },
  "package_prediction": {
    "current_bracket": "e.g. ₹6.5 LPA - ₹9.0 LPA",
    "current_tier": "e.g. Tier-2 Product / Fast-Growing Tech Services",
    "current_rationale": "Clear honest breakdown of why this resume currently commands this salary range.",
    "potential_bracket": "e.g. ₹15.0 LPA - ₹22.0 LPA",
    "potential_tier": "e.g. Tier-1 High-Scale Product Firms / FAANG / Fintech",
    "unlock_requirements": [
      "Exact step 1 to unlock higher CTC (e.g. Add distributed systems project with benchmark metrics)",
      "Exact step 2 (e.g. Deploy live app on cloud with GitHub Actions CI/CD)",
      "Exact step 3"
    ]
  },
  "strong_points": [
    { "title": "Standout Strength 1", "description": "Specific analysis of what makes this section strong", "tag": "Core Tech / Projects / Foundation" },
    { "title": "Standout Strength 2", "description": "Specific analysis", "tag": "Competitive Edge" },
    { "title": "Standout Strength 3", "description": "Specific analysis", "tag": "Execution" }
  ],
  "weak_points": [
    { "title": "Weakness 1", "description": "What hurts the candidate's chances here", "impact_level": "High" },
    { "title": "Weakness 2", "description": "What hurts the candidate's chances here", "impact_level": "Medium" }
  ],
  "loopholes": [
    {
      "loophole": "Identified loophole / missing scope",
      "why_it_matters": "Why an ATS or technical interviewer will flag or discount this",
      "how_to_fix": "Concrete action to close this loophole"
    },
    {
      "loophole": "Second loophole",
      "why_it_matters": "Why it matters",
      "how_to_fix": "How to fix"
    }
  ],
  "improvement_areas": [
    {
      "section": "Projects / Experience / Skills / Header",
      "critique": "Current flaw in this section",
      "action_plan": "Concrete, step-by-step guidance on transforming it"
    },
    {
      "section": "Technical Skills",
      "critique": "Current flaw",
      "action_plan": "Action plan"
    }
  ],
  "word_analysis": {
    "overused_buzzwords": ["worked on", "responsible for", "good communication", "handled"],
    "power_replacements": [
      { "weak_word": "worked on", "powerful_replacement": "Architected / Engineered", "usage_example": "Architected a real-time messaging pipeline..." },
      { "weak_word": "responsible for", "powerful_replacement": "Spearheaded", "usage_example": "Spearheaded backend database migration..." },
      { "weak_word": "helped", "powerful_replacement": "Collaborated / Accelerated", "usage_example": "Accelerated CI build cycles by 35%..." }
    ],
    "bullet_rewrites": [
      {
        "original_bullet": "An actual bullet point taken directly from the student's resume",
        "rewritten_bullet": "The same bullet rewritten using Google's X-Y-Z formula with high-impact power verbs and measurable hypothetical metrics",
        "formula_applied": "Google X-Y-Z Formula (Accomplished [X] measured by [Y] doing [Z])",
        "why_it_wins": "Why the recruiter and ATS will rank this rewrite 10x higher"
      },
      {
        "original_bullet": "A second bullet taken directly from the resume",
        "rewritten_bullet": "The high-impact rewrite",
        "formula_applied": "Action-Context-Result (ACR) framework",
        "why_it_wins": "Why this version demonstrates commercial engineering readiness"
      }
    ]
  },
  "market_comparison": [
    {
      "aspect": "ATS Formatting & Structure",
      "your_resume": "State what this candidate's resume does",
      "top_1_percent_standard": "What top 1% candidates do",
      "gap_severity": "Critical"
    },
    {
      "aspect": "Proof of Work & Live Links",
      "your_resume": "State current status",
      "top_1_percent_standard": "Verified GitHub repo, deployed demo URL, and architecture doc",
      "gap_severity": "Critical"
    },
    {
      "aspect": "Metrics & Impact Statements",
      "your_resume": "State current metrics status",
      "top_1_percent_standard": "Every bullet point specifies scale, latency, users, or efficiency gains",
      "gap_severity": "Moderate"
    }
  ],
  "action_checklist": [
    "Quick win 1 for next 48 hours",
    "Quick win 2",
    "Quick win 3",
    "Quick win 4",
    "Quick win 5"
  ],
  "motivation_boost": "A strong, genuine, inspiring closing message addressing the student directly. Remind them that resumes are living engineering documents, and their projects already give them great raw material to crack top-tier tech placements."
}
`;

    let chatCompletion;
    try {
      chatCompletion = await ai.chat.completions.create({
        messages: [
          { role: "system", content: RESUME_SYSTEM_PROMPTS.ATS_REVIEWER },
          { role: "user", content: prompt },
        ],
        model: PRIMARY_MODEL,
        temperature: 0.35,
        response_format: { type: "json_object" },
        max_tokens: 6000,
      });
    } catch (primaryErr) {
      console.warn("Primary model failed, falling back to 20b:", primaryErr);
      chatCompletion = await ai.chat.completions.create({
        messages: [
          { role: "system", content: RESUME_SYSTEM_PROMPTS.ATS_REVIEWER },
          { role: "user", content: prompt },
        ],
        model: FALLBACK_MODEL,
        temperature: 0.35,
        response_format: { type: "json_object" },
        max_tokens: 5000,
      });
    }

    const rawText = chatCompletion.choices[0]?.message?.content;
    if (!rawText) throw new Error("No response generated from AI");

    const parsedJson = JSON.parse(rawText);
    const validatedData = ResumeReviewResponseSchema.parse(parsedJson);

    // Save to database if table exists (graceful if table hasn't been migrated yet)
    try {
      await supabase.from("ai_resume_reviews").insert({
        student_id: user.id,
        resume_title: candidateName ? `${candidateName}'s Resume` : "Resume Review",
        review_data: validatedData,
      });
    } catch (saveErr) {
      console.warn("Could not save to ai_resume_reviews table:", saveErr);
    }

    return NextResponse.json({ success: true, data: validatedData });
  } catch (error: unknown) {
    console.error("Resume Review API Error:", error);
    const msg = error instanceof Error ? error.message : "Failed to review resume";
    return NextResponse.json(
      { error: "Could not complete the resume review. " + msg },
      { status: 500 }
    );
  }
}
