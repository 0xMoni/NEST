import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import styles from "./student.module.css";

export default async function StudentHome() {
  const me = await requireRole("student");
  const supabase = await createClient();

  // RLS does the filtering: this returns only this student's rows, whatever
  // the query says. There is no student_id filter here on purpose.
  const { data: attendance } = await supabase
    .from("v_student_attendance")
    .select("subject_code, subject_name, held, attended, percentage, short")
    .order("percentage", { ascending: true });

  const rows = attendance ?? [];
  const held = rows.reduce((n, r) => n + Number(r.held ?? 0), 0);
  const attended = rows.reduce((n, r) => n + Number(r.attended ?? 0), 0);
  const overall = held ? Math.round((1000 * attended) / held) / 10 : null;
  const shortfalls = rows.filter((r) => r.short);

  return (
    <Shell me={me} title={`Hello, ${me.full_name.split(" ")[0]}`} sub={me.usn ?? undefined}>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.label}>Attendance</span>
          <strong className={styles.big}>{overall === null ? "—" : `${overall}%`}</strong>
          <span className={styles.foot}>
            {held ? `${attended} of ${held} classes` : "nothing recorded yet"}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.label}>Subjects below 75%</span>
          <strong className={styles.big}>{rows.length ? shortfalls.length : "—"}</strong>
          <span className={styles.foot}>
            {shortfalls.length ? shortfalls.map((s) => s.subject_code).join(", ") : "all on track"}
          </span>
        </div>
      </div>

      <h2 className={styles.h2}>By subject</h2>
      {rows.length === 0 ? (
        <p className={styles.empty}>
          No attendance has been marked yet. Once a faculty member marks their first class, it appears
          here.
        </p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject</th>
                <th>Held</th>
                <th>Attended</th>
                <th>%</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subject_code}>
                  <td className={styles.code}>{r.subject_code}</td>
                  <td>{r.subject_name}</td>
                  <td className={styles.num}>{r.held}</td>
                  <td className={styles.num}>{r.attended}</td>
                  <td className={styles.num}>{r.percentage}%</td>
                  <td>
                    <span className={r.short ? styles.short : styles.ok}>
                      {r.short ? "Short" : "On track"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
