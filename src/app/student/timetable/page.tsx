import { Fragment } from "react";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Empty } from "@/components/ui";
import { PERIODS, BREAK_AFTER, periodAt } from "@/lib/periods";
import styles from "./timetable.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Slot = { day: number; period: number; code: string; name: string; who: string };

export default async function StudentTimetable() {
  const me = await requireRole("student");
  const supabase = await createClient();

  const { data } = await supabase
    .from("timetable_slots")
    .select("day_of_week, period, faculty_assignments!inner(subjects!inner(code, name), profiles!inner(full_name))");

  const slots: Slot[] = (data ?? []).map((s) => ({
    day: s.day_of_week,
    period: s.period,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: (s as any).faculty_assignments.subjects.code,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (s as any).faculty_assignments.subjects.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    who: (s as any).faculty_assignments.profiles.full_name,
  }));

  // A dot, not a tinted cell. Enough to tell two subjects apart in a glance,
  // quiet enough to look at every day.
  const codes = [...new Set(slots.map((s) => s.code))].sort();
  const hue = (code: string) => `${(codes.indexOf(code) * 67 + 200) % 360}`;

  const now = new Date();
  const today = now.getDay();
  const { current, next } = periodAt(now);

  const at = (day: number, period: number) => slots.find((s) => s.day === day && s.period === period);
  const onToday = today >= 1 && today <= 6;
  const nowClass = onToday && current ? at(today, current) : undefined;
  const nextClass = onToday && next ? at(today, next) : undefined;

  const key = codes.map((code) => {
    const s = slots.find((x) => x.code === code)!;
    return { code, name: s.name, who: s.who };
  });

  return (
    <Shell me={me} title="Timetable" sub="Your week." wide>
      {slots.length === 0 ? (
        <Empty>No timetable has been set for your section yet.</Empty>
      ) : (
        <>
          <p className={styles.status}>
            <span>
              <span className={styles.statLabel}>Now</span>
              {nowClass ? (
                <>
                  <b className={styles.statNow}>{nowClass.name}</b>{" "}
                  <span className={styles.statMeta}>until {PERIODS[current! - 1].to}</span>
                </>
              ) : (
                <span className={styles.statMeta}>
                  {today === 0 ? "Sunday — nothing scheduled" : current ? "Free period" : "Outside class hours"}
                </span>
              )}
            </span>
            <span>
              <span className={styles.statLabel}>Next</span>
              {nextClass ? (
                <>
                  <b>{nextClass.name}</b>{" "}
                  <span className={styles.statMeta}>at {PERIODS[next! - 1].from}</span>
                </>
              ) : (
                <span className={styles.statMeta}>nothing left today</span>
              )}
            </span>
          </p>

          <div className={styles.wrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th />
                  {PERIODS.map((p) => (
                    <Fragment key={p.n}>
                      <th>
                        <span className={styles.pNum}>P{p.n}</span>
                        <span className={styles.pTime}>{p.from}</span>
                      </th>
                      {BREAK_AFTER[p.n as keyof typeof BREAK_AFTER] && (
                        <th className={styles.gap}>
                          <span className={styles.gapHead}>
                            {BREAK_AFTER[p.n as keyof typeof BREAK_AFTER]}
                          </span>
                        </th>
                      )}
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((label, i) => {
                  const day = i + 1;
                  return (
                    <tr key={label} className={day === today ? styles.today : undefined}>
                      <th scope="row" className={styles.dayCell}>{label}</th>
                      {PERIODS.map((p) => {
                        const slot = at(day, p.n);
                        const isCurrent = day === today && p.n === current;
                        return (
                          <Fragment key={p.n}>
                            <td>
                              {slot ? (
                                <div
                                  className={`${styles.slot} ${isCurrent ? styles.current : ""}`}
                                  title={`${slot.name} · ${slot.who}`}
                                >
                                  <span className={styles.code}>
                                    <i className={styles.dot} style={{ ["--h" as string]: hue(slot.code) }} />
                                    {slot.code}
                                  </span>
                                  <span className={styles.name}>{slot.name}</span>
                                </div>
                              ) : (
                                <div className={styles.free} />
                              )}
                            </td>
                            {BREAK_AFTER[p.n as keyof typeof BREAK_AFTER] && (
                              <td className={styles.gap}>
                                <div className={styles.gapRule} />
                              </td>
                            )}
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.key}>
            {key.map((k) => (
              <span key={k.code} className={styles.keyItem}>
                <i className={styles.keyDot} style={{ ["--h" as string]: hue(k.code) }} />
                <b>{k.name}</b>
                <span>{k.who}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
