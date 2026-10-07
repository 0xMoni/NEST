"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Tick off an alert. The trigger added with this feature means a student can
 *  set this and nothing else — they cannot reword what their mentor asked. */
export async function acknowledge(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentor_alerts")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/student/mentor");
  revalidatePath("/student");
  return { ok: true };
}
