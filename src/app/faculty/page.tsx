import Link from "next/link";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import styles from "./faculty.module.css";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function FacultyHome() {
  const me = await requireRole("faculty");
  const supabase = await createClient();

  const now = new Date();
  const dow = now.getDay(); // 0 Sunday … 6 Saturday
  const today = now.toISOString().slice(0, 10);

  // RLS limits this to the classes this faculty member actually teaches.
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select(
      "period, assignment_id, faculty_assignments!inner(id, sections!inner(dept, semester, name), subjects!inner(code, name))",
    )
    .eq("day_of_week", dow)
    .order("period");

  const { data: marked } = await supabase
    .from("attendance_sessions")
    .select("assignment_id, period")
    .eq("held_on", today);

  const done = new Set((marked ?? []).map((m) => `${m.assignment_id}:${m.period}`));
  const classes = slots ?? [];

  return (
    <Shell me={me} title={`Hello, ${me.full_name.split(" ").slice(-1)[0]}`} sub={`${DAYS[dow]}, ${now.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`}>
      <h2 className={styles.h2}>Today&apos;s classes</h2>

      {classes.length === 0 ? (
        <p className={styles.empty}>
          {dow === 0
            ? "It's Sunday — nothing scheduled."
            : "No classes on your timetable today."}
        </p>
      ) : (
        <ul className={styles.list}>
          {classes.map((s) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fa = s.faculty_assignments as any;
            const isDone = done.has(`${s.assignment_id}:${s.period}`);
            return (
              <li key={`${s.assignment_id}-${s.period}`} className={styles.row}>
                <span className={styles.period}>P{s.period}</span>
                <span className={styles.subject}>
                  <b>{fa.subjects.name}</b>
                  <span className={styles.meta}>
                    {fa.subjects.code} · {fa.sections.dept}-{fa.sections.semester}
                    {fa.sections.name}
                  </span>
                </span>
                {isDone && <span className={styles.done}>Marked</span>}
                <Link
                  className={styles.action}
                  href={`/faculty/attendance/${s.assignment_id}?period=${s.period}&date=${today}`}
                >
                  {isDone ? "Edit" : "Mark attendance"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
