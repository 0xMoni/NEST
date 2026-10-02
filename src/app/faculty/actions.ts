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
