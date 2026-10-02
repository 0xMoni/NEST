import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { MarkEntry } from "./MarkEntry";

export default async function EnterMarks({ params }: { params: Promise<{ assessmentId: string }> }) {
  const me = await requireRole("faculty");
  const { assessmentId } = await params;
  const supabase = await createClient();

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, title, max_marks, published, assignment_id, faculty_assignments!inner(section_id, subjects!inner(code, name))")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!assessment) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fa = assessment.faculty_assignments as any;

  const { data: enrolled } = await supabase
    .from("section_students")
    .select("profiles!inner(id, full_name, usn)")
    .eq("section_id", fa.section_id);

  const students = (enrolled ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e) => (e as any).profiles)
    .sort((a, b) => (a.usn ?? "").localeCompare(b.usn ?? ""));

  const { data: existing } = await supabase
    .from("marks")
    .select("student_id, scored")
    .eq("assessment_id", assessmentId);

  const scored = Object.fromEntries((existing ?? []).map((m) => [m.student_id, m.scored]));

  return (
    <Shell
      me={me}
      title={assessment.title}
      sub={`${fa.subjects.name} · out of ${assessment.max_marks}`}
    >
      <MarkEntry
        assessmentId={assessmentId}
        maxMarks={Number(assessment.max_marks)}
        published={assessment.published}
        students={students}
        initial={scored}
      />
    </Shell>
  );
}
