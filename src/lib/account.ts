"use server";

import { createClient } from "@/lib/supabase/server";

/** Change your own password.
 *
 *  Goes through the caller's session, so it can only ever change the password
 *  of whoever is signed in — there is no user id to get wrong. Every role gets
 *  the same action; a student does not need anyone's permission for this. */
export async function changePassword(formData: FormData) {
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "Use at least 6 characters." };
  if (next !== confirm) return { error: "Those two don't match." };
  if (next === "123456") return { error: "That's the default everyone starts with. Pick something else." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };

  // Clearing the flag is what opens the rest of the app, so it has to happen
  // here and not on the page — and it runs on the same session, so nobody can
  // clear anyone else's.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  }
  return { ok: true };
}
