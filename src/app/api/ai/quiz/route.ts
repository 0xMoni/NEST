import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiClient, MODEL_NAME } from "@/app/api/ai/roadmap/client";
import { SYSTEM_PROMPTS } from "@/app/api/ai/roadmap/prompts";
import { QuizResponseSchema } from "@/app/api/ai/roadmap/schemas";
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // 2. Action: Save final score to Supabase
    if (body.action === "save_score") {
      const { topic, score, total_questions, difficulty, quiz_data } = body;

      const { data, error: dbError } = await supabase
        .from("ai_quiz_attempts")
        .insert({
          student_id: user.id,
          topic,
          score,
          total_questions,
          difficulty: difficulty || "Intermediate",
          quiz_data,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Supabase Quiz Save Error:", dbError);
        return NextResponse.json(
          { error: "Failed to save quiz attempt" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, attempt: data });
    }

    // 3. Action: Generate quiz questions with Groq
    const { topic, difficulty = "Intermediate", count = 5 } = body;

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const prompt = `
      Topic: ${topic}
      Difficulty: ${difficulty}
      Number of questions: ${count}

      Generate a quiz JSON object matching this structure exactly:
      {
        "title": "Concise quiz title",
        "topic": "${topic}",
        "difficulty": "${difficulty}",
        "questions": [
          {
            "id": 1,
            "question": "Clear question text?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer_index": 0,
            "explanation": "Why Option A is correct."
          }
        ]
      }
    `;

    const ai = aiClient();
    if (!ai) {
      return NextResponse.json(
        { error: "The quiz service is not configured yet." },
        { status: 503 },
      );
    }

    const chatCompletion = await ai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.QUIZ },
        { role: "user", content: prompt },
      ],
      model: MODEL_NAME,
      temperature: 0.4,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content;
    if (!rawResponse) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const parsedJson = JSON.parse(rawResponse);
    const validatedQuiz = QuizResponseSchema.parse(parsedJson);

    return NextResponse.json(validatedQuiz);
  } catch (error: unknown) {
    // Detail to the log, a sentence to the student — a raw Groq or Postgres
    // message in the browser is noise at best.
    console.error("AI Quiz Route Error:", error);
    return NextResponse.json(
      { error: "Could not put a quiz together just now." },
      { status: 500 }
    );
  }
}