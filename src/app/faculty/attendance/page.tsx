import Link from "next/link";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty, Badge } from "@/components/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function FacultyAttendance() {
  const me = await requireRole("faculty");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("day_of_week, period, assignment_id, faculty_assignments!inner(sections!inner(dept, semester, name), subjects!inner(code, name))")
    .order("day_of_week")
    .order("period");

  const { data: marked } = await supabase
    .from("attendance_sessions")
    .select("assignment_id, period")
    .eq("held_on", today);

  const done = new Set((marked ?? []).map((m) => `${m.assignment_id}:${m.period}`));
  const rows = slots ?? [];

  return (
    <Shell me={me} title="Mark attendance" sub="Every class you teach. Marking a past date is a correction, not a duplicate.">
      {rows.length === 0 ? (
        <Empty>You have no classes on the timetable yet.</Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <thead>
              <tr><th>Day</th><th>Period</th><th>Subject</th><th>Section</th><th>Today</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fa = s.faculty_assignments as any;
                const isDone = done.has(`${s.assignment_id}:${s.period}`);
                return (
                  <tr key={`${s.assignment_id}-${s.day_of_week}-${s.period}`}>
                    <td className={ui.dim}>{DAYS[s.day_of_week]}</td>
                    <td className={ui.num}>P{s.period}</td>
                    <td>{fa.subjects.name} <span className={ui.dim}>{fa.subjects.code}</span></td>
                    <td className={ui.dim}>{fa.sections.dept}-{fa.sections.semester}{fa.sections.name}</td>
                    <td>{isDone ? <Badge tone="ok">Marked</Badge> : <Badge>—</Badge>}</td>
                    <td>
                      <Link href={`/faculty/attendance/${s.assignment_id}?period=${s.period}&date=${today}`}>
                        {isDone ? "Edit" : "Mark"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
