import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is not set in the environment variables.");
}

export const aiClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Use the current active fast model
export const MODEL_NAME = "openai/gpt-oss-20b";