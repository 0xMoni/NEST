import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty, Tile } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { SubjectRows, type Subject } from "./SubjectRows";

export default async function StudentAttendance() {
  const me = await requireRole("student");
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_student_attendance")
    .select("subject_code, subject_name, held, attended, percentage, short")
    .order("percentage", { ascending: true });

  // Every class this student was marked in. RLS limits it to their own rows,
  // so there is no student filter here.
  const { data: records } = await supabase
    .from("attendance_records")
    .select("status, attendance_sessions!inner(held_on, period, faculty_assignments!inner(subjects!inner(code)))");

  const sessionsByCode = new Map<string, { held_on: string; period: number; missed: boolean }[]>();
  for (const r of records ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (r as any).attendance_sessions;
    const code = s.faculty_assignments.subjects.code;
    const list = sessionsByCode.get(code) ?? [];
    list.push({ held_on: s.held_on, period: s.period, missed: r.status === "absent" });
    sessionsByCode.set(code, list);
  }
  for (const list of sessionsByCode.values()) {
    list.sort((a, b) => b.held_on.localeCompare(a.held_on) || b.period - a.period);
  }

  const rows = data ?? [];
  const subjects: Subject[] = rows.map((r) => ({
    code: r.subject_code,
    name: r.subject_name,
    held: Number(r.held),
    attended: Number(r.attended),
    percentage: Number(r.percentage),
    short: Boolean(r.short),
    sessions: sessionsByCode.get(r.subject_code) ?? [],
  }));

  const held = subjects.reduce((n, r) => n + r.held, 0);
  const attended = subjects.reduce((n, r) => n + r.attended, 0);
  const overall = held ? Math.round((1000 * attended) / held) / 10 : null;
  const short = subjects.filter((r) => r.short);

  return (
    <Shell me={me} title="Attendance" sub="Per subject, and where you stand against the 75% rule.">
      <div className={ui.tiles}>
        <Tile label="Overall" value={overall === null ? "\u2014" : `${overall}%`} foot={held ? `${attended} of ${held} classes` : "nothing marked yet"} />
        <Tile label="Classes missed" value={held ? held - attended : "\u2014"} foot="across all subjects" />
        <Tile
          label="Subjects to watch"
          value={subjects.length ? short.length : "\u2014"}
          foot={short.length ? short.map((s) => `${s.code} \u00b7 ${s.percentage}%`).join(", ") : "all on track"}
        />
      </div>

      {subjects.length === 0 ? (
        <Empty>
          Nothing has been marked yet. Your attendance appears here as soon as a faculty member marks
          their first class.
        </Empty>
      ) : (
        <>
          <p className={ui.foot} style={{ marginBottom: 12 }}>
            Open a subject to see the individual classes, and which ones you missed.
          </p>
          <SubjectRows subjects={subjects} />
          <div style={{ marginTop: 22 }}>
            <PrintButton />
          </div>
        </>
      )}
    </Shell>
  );
}
