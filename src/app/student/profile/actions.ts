"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SECTIONS, type SectionId } from "@/lib/profile-sections";

export async function requestEdit(section: SectionId, reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("profile_edit_requests")
    .insert({ student_id: user.id, section, reason: reason.trim() || null });

  if (error) {
    return {
      error: error.code === "23505" ? "You already have a request open for this section." : error.message,
    };
  }
  revalidatePath("/student/profile");
  return { ok: true };
}

export async function withdrawRequest(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("profile_edit_requests").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/student/profile");
  return { ok: true };
}

export async function saveSection(section: SectionId, values: Record<string, string>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Only ever write the fields belonging to this section — a payload naming
  // someone else's column should not travel further than here.
  const allowed = SECTIONS.find((s) => s.id === section)?.fields.map((f) => f.key) ?? [];
  const patch: Record<string, string | null> = {};
  for (const key of allowed) patch[key] = values[key]?.trim() || null;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);

  // The trigger raises in plain language when a section is locked, so that
  // message is better than anything written here.
  if (error) return { error: error.message };

  revalidatePath("/student/profile");
  return { ok: true };
}
