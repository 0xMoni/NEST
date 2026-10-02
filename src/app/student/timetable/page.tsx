import { Fragment } from "react";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Empty } from "@/components/ui";
import { PERIODS, BREAK_AFTER, periodAt } from "@/lib/periods";
import styles from "./timetable.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

  // A subject keeps the same colour all week, so the grid is readable at a
  // glance rather than needing the labels read.
  const codes = [...new Set(slots.map((s) => s.code))].sort();
  const hue = (code: string) => `var(--h${(codes.indexOf(code) % 6) + 1})`;

  const now = new Date();
  const today = now.getDay();
  const { current, next } = periodAt(now);

  const at = (day: number, period: number) => slots.find((s) => s.day === day && s.period === period);
  const nowClass = today >= 1 && today <= 6 && current ? at(today, current) : undefined;
  const nextClass = today >= 1 && today <= 6 && next ? at(today, next) : undefined;

  const perSubject = codes.map((code) => {
    const s = slots.find((x) => x.code === code)!;
    return { ...s, count: slots.filter((x) => x.code === code).length };
  });

  return (
    <Shell me={me} title="Timetable" sub="Your week, and what is running right now." wide>
      {slots.length === 0 ? (
        <Empty>No timetable has been set for your section yet.</Empty>
      ) : (
        <>
          <div className={styles.status}>
            <div className={styles.now}>
              <span className={styles.statLabel}>Now</span>
              {nowClass ? (
                <>
                  <b className={styles.statSubject}>{nowClass.name}</b>
                  <span className={styles.statMeta}>
                    Period {current} · until {PERIODS[current! - 1].to} · {nowClass.who}
                  </span>
                </>
              ) : (
                <>
                  <b className={styles.statSubject}>Nothing right now</b>
                  <span className={styles.statMeta}>
                    {today === 0 ? "It's Sunday." : current ? "Free period." : "Outside class hours."}
                  </span>
                </>
              )}
            </div>

            <div className={styles.next}>
              <span className={styles.statLabel}>Next</span>
              {nextClass ? (
                <>
                  <b className={styles.statSubject}>{nextClass.name}</b>
                  <span className={styles.statMeta}>
                    Period {next} · {PERIODS[next! - 1].from} · {nextClass.who}
                  </span>
                </>
              ) : (
                <>
                  <b className={styles.statSubject}>Nothing left today</b>
                  <span className={styles.statMeta}>{LONG[(today + 1) % 7]} is next.</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.wrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th />
                  {PERIODS.map((p) => (
                    <Fragment key={p.n}>
                      <th>
                        <span className={styles.pNum}>Period {p.n}</span>
                        <span className={styles.pTime}>{p.from}–{p.to}</span>
                      </th>
                      {BREAK_AFTER[p.n as keyof typeof BREAK_AFTER] && (
                        <th className={styles.gap} />
                      )}
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((label, i) => {
                  const day = i + 1;
                  const count = slots.filter((s) => s.day === day).length;
                  return (
                    <tr key={label} className={day === today ? styles.today : undefined}>
                      <th scope="row" className={styles.dayCell}>
                        <span className={styles.dayName}>{label}</span>
                        <span className={styles.dayCount}>{count} class{count === 1 ? "" : "es"}</span>
                      </th>
                      {PERIODS.map((p) => {
                        const slot = at(day, p.n);
                        const isCurrent = day === today && p.n === current;
                        return (
                          <Fragment key={p.n}>
                            <td>
                              {slot ? (
                                <div
                                  className={`${styles.slot} ${isCurrent ? styles.current : ""}`}
                                  style={{ ["--h" as string]: hue(slot.code) }}
                                >
                                  {isCurrent && <span className={styles.nowTag}>Now</span>}
                                  <span className={styles.code}>{slot.code}</span>
                                  <span className={styles.name}>{slot.name}</span>
                                  <span className={styles.who}>{slot.who}</span>
                                </div>
                              ) : (
                                <div className={styles.free}>Free</div>
                              )}
                            </td>
                            {BREAK_AFTER[p.n as keyof typeof BREAK_AFTER] && (
                              <td className={styles.gap}>
                                {i === 0 && (
                                  <span className={styles.gapLabel}>
                                    {BREAK_AFTER[p.n as keyof typeof BREAK_AFTER]}
                                  </span>
                                )}
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

          <div className={styles.legend}>
            {perSubject.map((s) => (
              <div key={s.code} className={styles.legendItem} style={{ ["--h" as string]: hue(s.code) }}>
                <b>{s.name}</b>
                <span>{s.who}</span>
                <span className={styles.legendCount}>{s.count}/wk</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
