import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Where the link in the email lands.
 *
 *  Exchanging the one-time token here sets the session cookie, which is what
 *  lets /reset-password set a password without asking for the old one.
 *
 *  Supabase can send either shape depending on the email template, so both
 *  are accepted: `code` is what the stock template produces, `token_hash` is
 *  what a template written against {{ .TokenHash }} produces. Handling both
 *  means the flow works whether or not anyone has edited the template. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/reset-password";
  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (token_hash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // A used link, an expired one, or a tampered one all land the same way.
  return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
}
