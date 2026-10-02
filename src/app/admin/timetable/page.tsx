import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty } from "@/components/ui";
import styles from "@/app/student/timetable/timetable.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6];

export default async function AdminTimetable() {
  const me = await requireRole("admin");
  const supabase = await createClient();

  const { data: sections } = await supabase
    .from("sections")
    .select("id, dept, semester, name")
    .order("semester")
    .order("name");

  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("day_of_week, period, faculty_assignments!inner(section_id, subjects!inner(code), profiles!inner(full_name))");

  const all = slots ?? [];

  return (
    <Shell me={me} title="Timetable" sub="Every section's week. Attendance marking reads straight from this.">
      {(sections ?? []).length === 0 ? (
        <Empty>No sections exist yet.</Empty>
      ) : (
        (sections ?? []).map((sec) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mine = all.filter((s: any) => s.faculty_assignments.section_id === sec.id);
          return (
            <section key={sec.id}>
              <h2 className={ui.h2}>{sec.dept}-{sec.semester}{sec.name}</h2>
              {mine.length === 0 ? (
                <Empty>No slots set for this section.</Empty>
              ) : (
                <div className={ui.scroll}>
                  <table className={styles.grid}>
                    <thead>
                      <tr><th />{PERIODS.map((p) => <th key={p}>P{p}</th>)}</tr>
                    </thead>
                    <tbody>
                      {DAYS.map((label, i) => (
                        <tr key={label}>
                          <th scope="row">{label}</th>
                          {PERIODS.map((p) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const slot = mine.find((s: any) => s.day_of_week === i + 1 && s.period === p) as any;
                            return (
                              <td key={p}>
                                {slot ? (
                                  <>
                                    <b>{slot.faculty_assignments.subjects.code}</b>
                                    <span>{slot.faculty_assignments.profiles.full_name}</span>
                                  </>
                                ) : (
                                  <i className={styles.free}>—</i>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}
    </Shell>
  );
}
