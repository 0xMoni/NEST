import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server"; 
import { aiClient, MODEL_NAME } from "@/app/api/ai/roadmap/client";
import { SYSTEM_PROMPTS } from "@/app/api/ai/roadmap/prompts";
import { RoadmapResponseSchema } from "@/app/api/ai/roadmap/schemas";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ai = aiClient();
    if (!ai) {
      return NextResponse.json(
        { error: "The roadmap service is not configured yet." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { career_goal, current_skills } = body;

    if (!career_goal) {
      return NextResponse.json({ error: "Career goal is required" }, { status: 400 });
    }

    const prompt = `
  Target Career: ${career_goal}
  Current Skills: ${current_skills || "Beginner"}

  Generate a roadmap JSON object matching this structure exactly:
  {
    "career_goal": "${career_goal}",
    "current_level": "Beginner / Intermediate",
    "estimated_duration": "e.g. 6 Months",
    "summary": "overview summary",
    "phases": [
      {
        "title": "Phase title",
        "duration": "e.g. 4 Weeks",
        "objectives": ["objective 1"],
        "skills": ["skill 1"],
        "topics": ["topic 1"],
        "projects": ["project 1"],
        "resources": ["resource 1"],
        "milestones": ["milestone 1"]
      }
    ],
    "missing_skills": ["skill 1", "skill 2"],
    "recommended_projects": ["project 1"],
    "next_steps": ["step 1"]
  }
`;

    // 1. Call Groq API
    // 1. Call Groq API
const chatCompletion = await ai.chat.completions.create({
  messages: [
    { role: "system", content: SYSTEM_PROMPTS.ROADMAP },
    { role: "user", content: prompt },
  ],
  model: MODEL_NAME,
  temperature: 0.5,
  response_format: { type: "json_object" },
  max_tokens: 5000, // <-- Add this line to allow longer outputs
});

    const rawText = chatCompletion.choices[0]?.message?.content;
    if (!rawText) throw new Error("No response from AI");

    // 2. Parse and Validate
    const parsedJson = JSON.parse(rawText);
    const validatedData = RoadmapResponseSchema.parse(parsedJson);

    // 3. Save to Supabase
    const { error: dbError } = await supabase
      .from("ai_roadmaps")
      .insert({
        student_id: user.id,
        career_goal: career_goal,
        roadmap_data: validatedData,
      });

    if (dbError) {
      console.error("Supabase Error:", dbError);
      throw new Error("Failed to save roadmap to database.");
    }

    return NextResponse.json({ success: true, data: validatedData });

  } catch (error: unknown) {
    // The detail goes to the server log; the student gets a sentence. A raw
    // Groq or Postgres message in the browser is noise at best and a hint
    // about the inside of the app at worst.
    console.error("Roadmap Error:", error);
    return NextResponse.json({ error: "Could not generate a roadmap just now." }, { status: 500 });
  }
}