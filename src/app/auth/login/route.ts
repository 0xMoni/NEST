import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Sign in with a USN or a college email.
 *
 *  Students know their USN; the college's email schemes are inconsistent and
 *  35 students have no address at all. Staff have an email and no USN, so the
 *  one field accepts either.
 *
 *  The USN → email lookup happens here rather than in the browser, so no one
 *  can walk the USN range and harvest addresses. Every failure returns the
 *  same message for the same reason. */
export async function POST(request: Request) {
  const { identifier, password } = await request.json().catch(() => ({}));

  if (typeof identifier !== "string" || typeof password !== "string" || !identifier || !password) {
    return NextResponse.json({ error: "Enter your USN or email, and your password." }, { status: 400 });
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

  // Unknown USN and wrong password are deliberately indistinguishable: saying
  // which it was lets someone enumerate who actually has an account.
  const generic = { error: "Those details don't match an account." };

  if (!email) return NextResponse.json(generic, { status: 401 });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return NextResponse.json(generic, { status: 401 });

  return NextResponse.json({ ok: true });
}
