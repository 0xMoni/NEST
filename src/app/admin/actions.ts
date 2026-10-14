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
  if (me?.role !== "admin") return { error: "Only the HOD can create accounts." };

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

/** Every write below goes through the caller's own session, so the "admin
 *  manages …" policies decide whether it lands. Nothing here re-checks the
 *  role except createPerson, which needs the secret key and therefore has to. */

async function db() {
  return await createClient();
}

export async function createSubject(formData: FormData) {
  const supabase = await db();
  const { error } = await supabase.from("subjects").insert({
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: String(formData.get("name") ?? "").trim(),
    semester: Number(formData.get("semester")),
    credits: Number(formData.get("credits")) || 4,
  });
  if (error) {
    return { error: error.code === "23505" ? "A subject with that code already exists." : error.message };
  }
  revalidatePath("/admin/structure");
  return { ok: true };
}

export async function createSection(formData: FormData) {
  const supabase = await db();
  const { error } = await supabase.from("sections").insert({
    dept: String(formData.get("dept") ?? "").trim().toUpperCase(),
    semester: Number(formData.get("semester")),
    name: String(formData.get("name") ?? "").trim().toUpperCase(),
  });
  if (error) {
    return { error: error.code === "23505" ? "That section already exists." : error.message };
  }
  revalidatePath("/admin/structure");
  return { ok: true };
}

export async function createAssignment(formData: FormData) {
  const supabase = await db();
  const { error } = await supabase.from("faculty_assignments").insert({
    section_id: String(formData.get("section_id")),
    subject_id: String(formData.get("subject_id")),
    faculty_id: String(formData.get("faculty_id")),
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That section already has someone teaching this subject."
          : error.message,
    };
  }
  revalidatePath("/admin/structure");
  revalidatePath("/admin/timetable");
  return { ok: true };
}

export async function removeAssignment(id: string) {
  const supabase = await db();
  const { error } = await supabase.from("faculty_assignments").delete().eq("id", id);
  // Attendance and marks cascade from an assignment, so the database refuses
  // once either exists. Saying so beats a foreign key error.
  if (error) {
    return {
      error: error.code === "23503"
        ? "This class already has attendance or marks against it, so it can't be removed."
        : error.message,
    };
  }
  revalidatePath("/admin/structure");
  return { ok: true };
}

/** Put a class in a slot, or clear it. One assignment per day and period, so
 *  setting a slot that is already taken replaces what was there. */
export async function setSlot(day: number, period: number, assignmentId: string | null, sectionId: string) {
  const supabase = await db();

  const { data: existing } = await supabase
    .from("timetable_slots")
    .select("id, faculty_assignments!inner(section_id)")
    .eq("day_of_week", day)
    .eq("period", period);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const here = (existing ?? []).find((s) => (s as any).faculty_assignments.section_id === sectionId);
  if (here) await supabase.from("timetable_slots").delete().eq("id", here.id);

  if (assignmentId) {
    const { error } = await supabase
      .from("timetable_slots")
      .insert({ assignment_id: assignmentId, day_of_week: day, period });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/timetable");
  revalidatePath("/student/timetable");
  revalidatePath("/faculty");
  return { ok: true };
}
