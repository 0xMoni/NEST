"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Save attendance for one class.
 *
 *  Every write goes through the caller's own session, so row-level security
 *  decides whether they teach this class. Nothing here checks it — that is
 *  deliberate, because a check in application code is one someone can forget. */
export async function saveAttendance(
  assignmentId: string,
  heldOn: string,
  period: number,
  absentIds: string[],
  allStudentIds: string[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Marking the same class again corrects it. The unique constraint on
  // (assignment, date, period) is what makes that true rather than hoped for.
  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .upsert(
      { assignment_id: assignmentId, held_on: heldOn, period, taken_by: user.id },
      { onConflict: "assignment_id,held_on,period" },
    )
    .select("id")
    .single();

  if (sessionError) return { error: sessionError.message };

  const absent = new Set(absentIds);
  const { error } = await supabase.from("attendance_records").upsert(
    allStudentIds.map((id) => ({
      session_id: session.id,
      student_id: id,
      status: absent.has(id) ? "absent" : "present",
    })),
    { onConflict: "session_id,student_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/faculty");
  revalidatePath("/student");
  return { ok: true, present: allStudentIds.length - absent.size, absent: absent.size };
}

/** Create an assessment. Starts unpublished — students see nothing until the
 *  faculty member says so. */
export async function createAssessment(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("assessments").insert({
    assignment_id: String(formData.get("assignment_id")),
    title: String(formData.get("title")).trim(),
    max_marks: Number(formData.get("max_marks")),
    held_on: String(formData.get("held_on")) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/faculty/marks");
  return { ok: true };
}

export async function saveMarks(
  assessmentId: string,
  scores: { student_id: string; scored: number | null }[],
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("marks")
    .upsert(scores.map((s) => ({ assessment_id: assessmentId, ...s })), {
      onConflict: "assessment_id,student_id",
    });
  if (error) return { error: error.message };
  revalidatePath(`/faculty/marks/${assessmentId}`);
  revalidatePath("/student/scorecard");
  return { ok: true };
}

/** Publishing is the moment marks become real to students, so it is its own
 *  deliberate action rather than a side effect of saving. */
export async function setPublished(assessmentId: string, published: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("assessments").update({ published }).eq("id", assessmentId);
  if (error) return { error: error.message };
  revalidatePath(`/faculty/marks/${assessmentId}`);
  revalidatePath("/faculty/marks");
  revalidatePath("/student/scorecard");
  return { ok: true };
}

/** Approve or refuse a mentee's request to edit a profile section.
 *
 *  Approving opens a window rather than unlocking permanently — a student who
 *  needed to fix an address in October should not still have the section open
 *  in March. */
export async function decideEditRequest(id: string, approve: boolean, hours = 48) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("profile_edit_requests")
    .update({
      status: approve ? "approved" : "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      expires_at: approve ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/faculty/mentees");
  return { ok: true };
}

/** Send a mentee an alert. The mentor policy decides whether this lands, so
 *  there is no mentee check here — a stranger's id simply fails. */
export async function createAlert(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the alert a title — it is what the student sees first." };

  const { error } = await supabase.from("mentor_alerts").insert({
    mentor_id: user.id,
    student_id: String(formData.get("student_id")),
    kind: String(formData.get("kind") ?? "task"),
    urgent: formData.get("urgent") === "on",
    title,
    message: String(formData.get("message") ?? "").trim() || null,
    due_text: String(formData.get("due_text") ?? "").trim() || null,
  });

  if (error) {
    return {
      error: error.code === "42501"
        ? "You can only send alerts to your own mentees."
        : error.message,
    };
  }
  revalidatePath("/faculty/mentees");
  revalidatePath("/student/mentor");
  return { ok: true };
}

export async function deleteAlert(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("mentor_alerts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/faculty/mentees");
  return { ok: true };
}

// Cabin and office hours are free text on purpose: a cabin is "214, Block B"
// at one college and "Staff Room 3" at the next, and nobody writes their
// hours the same way twice.
export async function saveContact(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ cabin: text("cabin"), office_hours: text("office_hours"), phone: text("phone") })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/faculty/mentees");
  revalidatePath("/student/mentor");
  return { ok: true };
}
