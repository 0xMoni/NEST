"use server";

import { createClient } from "@/lib/supabase/server";

/** Change your own password.
 *
 *  Goes through the caller's session, so it can only ever change the password
 *  of whoever is signed in — there is no user id to get wrong. */
export async function changePassword(formData: FormData) {
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "Use at least 6 characters." };
  if (next !== confirm) return { error: "Those two don't match." };
  if (next === "123456") return { error: "That's the default everyone starts with. Pick something else." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return { ok: true };
}
