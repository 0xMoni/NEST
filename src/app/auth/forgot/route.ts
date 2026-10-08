import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Ask for a reset link.
 *
 *  Takes a USN or an email, for the same reason the login route does. The
 *  USN → email lookup stays on the server so nobody can walk the USN range
 *  and learn which students have an address on file.
 *
 *  The reply never says whether the account exists. A page that answers
 *  "no such USN" is a tool for working out who is enrolled, and the roll
 *  numbers are sequential. */
export async function POST(request: Request) {
  const { identifier } = await request.json().catch(() => ({}));
  const sent = NextResponse.json({ ok: true });

  if (typeof identifier !== "string" || !identifier.trim()) {
    return NextResponse.json({ error: "Enter your USN or email." }, { status: 400 });
  }

  const id = identifier.trim();
  let email = id.includes("@") ? id.toLowerCase() : null;

  if (!email) {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("email")
      .ilike("usn", id)
      .maybeSingle();
    email = data?.email ?? null;
  }

  if (!email) return sent;

  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  // Errors are swallowed on purpose — a rate limit or a bounce is not the
  // sender's business to know, and reporting it would leak the address.
  return sent;
}
