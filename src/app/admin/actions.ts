"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Create an account.
 *
 *  Creating a user needs the secret key, which bypasses every policy — so the
 *  caller's own role is checked first, through their session, before that key
 *  is touched at all. */
export async function createPerson(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Only the HOD or DOE can create accounts." };

  const role = String(formData.get("role"));
  const usn = String(formData.get("usn") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();

  if (!full_name) return { error: "A name is required." };
  if (!email) return { error: "An email address is required — it is what the account is created against." };
  if (role === "student" && !usn) return { error: "Students need a USN. It is what they sign in with." };

  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password: "123456",
    email_confirm: true,
    user_metadata: {
      full_name,
      role,
      usn: usn || null,
      dept: String(formData.get("dept") ?? "") || null,
      semester: Number(formData.get("semester")) || null,
    },
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/people");
  return { ok: true, email };
}
