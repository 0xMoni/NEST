import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { MarkSheet } from "./MarkSheet";

export default async function MarkAttendance({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const me = await requireRole("faculty");
  const { assignmentId } = await params;
  const { period: periodParam, date } = await searchParams;

  const period = Number(periodParam ?? 1);
  const heldOn = date ?? new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  // RLS means this comes back empty unless they teach it — no ownership check needed here.
  const { data: assignment } = await supabase
    .from("faculty_assignments")
    .select("id, section_id, sections!inner(dept, semester, name), subjects!inner(code, name)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: enrolled } = await supabase
    .from("section_students")
    .select("student_id, profiles!inner(id, full_name, usn)")
    .eq("section_id", assignment.section_id);

  const students = (enrolled ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e) => (e as any).profiles)
    .sort((a, b) => (a.usn ?? "").localeCompare(b.usn ?? ""));

  // If this class was marked before, open on what was saved rather than blank.
  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("held_on", heldOn)
    .eq("period", period)
    .maybeSingle();

  let absentIds: string[] = [];
  if (session) {
    const { data: records } = await supabase
      .from("attendance_records")
      .select("student_id, status")
      .eq("session_id", session.id)
      .eq("status", "absent");
    absentIds = (records ?? []).map((r) => r.student_id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = assignment as any;
  const when = new Date(heldOn).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Shell
      me={me}
      title={a.subjects.name}
      sub={`${a.sections.dept}-${a.sections.semester}${a.sections.name} · Period ${period} · ${when}`}
      wide
    >
      <MarkSheet
        assignmentId={assignmentId}
        heldOn={heldOn}
        period={period}
        students={students}
        initialAbsent={absentIds}
        alreadyMarked={Boolean(session)}
      />
    </Shell>
  );
}
