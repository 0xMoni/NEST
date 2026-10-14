"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Spend the one-time token from a reset email.
 *
 *  Only ever called from a form submission. Everything that fetches links
 *  without a person behind it — Gmail's scanner, the browser's prefetcher,
 *  Brevo's click tracker — issues a GET, and a GET no longer gets here. */
export async function confirmToken(formData: FormData) {
  const next = String(formData.get("next") ?? "/reset-password");
  const tokenHash = String(formData.get("token_hash") ?? "");
  const code = String(formData.get("code") ?? "");

  const supabase = await createClient();

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect("/forgot-password?expired=1");
}
