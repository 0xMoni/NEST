import Groq from "groq-sdk";

/** The key is read when a request arrives, not when this module loads.
 *
 *  Throwing at import time meant `next build` collected the route, hit the
 *  throw and failed the whole build for anyone without a Groq key — so one
 *  unconfigured feature took down every other page with it. A missing key is
 *  now one endpoint returning 503, which is what it actually is. */
export function aiClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

export const MODEL_NAME = "openai/gpt-oss-20b";
