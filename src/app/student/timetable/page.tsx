import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty } from "@/components/ui";
import styles from "./timetable.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6];

export default async function StudentTimetable() {
  const me = await requireRole("student");
  const supabase = await createClient();

  const { data } = await supabase
    .from("timetable_slots")
    .select("day_of_week, period, faculty_assignments!inner(subjects!inner(code, name), profiles!inner(full_name))");

  const slots = data ?? [];
  const today = new Date().getDay();

  const at = (day: number, period: number) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slots.find((s: any) => s.day_of_week === day && s.period === period) as any;

  return (
    <Shell me={me} title="Timetable" sub="Your week.">
      {slots.length === 0 ? (
        <Empty>No timetable has been set for your section yet.</Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th />
                {PERIODS.map((p) => (
                  <th key={p}>P{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((label, i) => {
                const day = i + 1;
                return (
                  <tr key={label} data-today={day === today}>
                    <th scope="row">{label}</th>
                    {PERIODS.map((p) => {
                      const slot = at(day, p);
                      return (
                        <td key={p}>
                          {slot ? (
                            <>
                              <b>{slot.faculty_assignments.subjects.code}</b>
                              <span>{slot.faculty_assignments.subjects.name}</span>
                            </>
                          ) : (
                            <i className={styles.free}>—</i>
                          )}
                        </td>
                      );
                    })}
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
