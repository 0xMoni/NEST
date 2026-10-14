import Link from "next/link";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import styles from "./student.module.css";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Chevron() {
  return (
    <svg className={styles.chev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default async function StudentHome() {
  const me = await requireRole("student");
  const supabase = await createClient();

  const now = new Date();
  const dow = now.getDay();
  const nowPeriod = Math.min(6, Math.max(1, now.getHours() - 8)); // rough: P1 starts around 09:00

  const [{ data: attendance }, { data: slots }, { data: mentorRow }, { data: alertRows }] = await Promise.all([
    supabase
      .from("v_student_attendance")
      .select("subject_code, subject_name, held, attended, percentage, short")
      .order("percentage", { ascending: true }),
    supabase
      .from("timetable_slots")
      .select("period, faculty_assignments!inner(subjects!inner(code, name))")
      .eq("day_of_week", dow)
      .order("period"),
    supabase
      .from("mentorships")
      .select("profiles!mentorships_mentor_id_fkey(full_name)")
      .eq("student_id", me.id)
      .maybeSingle(),
    supabase
      .from("mentor_alerts")
      .select("id, kind, urgent, title, due_text")
      .is("acknowledged_at", null)
      .order("urgent", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const rows = attendance ?? [];
  const held = rows.reduce((n, r) => n + Number(r.held ?? 0), 0);
  const attended = rows.reduce((n, r) => n + Number(r.attended ?? 0), 0);
  const overall = held ? Math.round((1000 * attended) / held) / 10 : null;
  const short = rows.filter((r) => r.short);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mentor = (mentorRow as any)?.profiles?.full_name ?? null;
  const alerts = alertRows ?? [];

  const periods = [1, 2, 3, 4, 5, 6];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byPeriod = new Map<number, any>((slots ?? []).map((s) => [s.period, s]));
  const upcoming = periods.find((p) => p > nowPeriod && byPeriod.has(p));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = byPeriod.get(nowPeriod) as any;

  return (
    <Shell me={me} title="" sub="" wide>
      <header className={styles.head}>
        <p className={styles.date}>
          {DAYS[dow]} · {now.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
        </p>
        <h1 style={{ fontFamily: "var(--font-newsreader), serif", fontWeight: 400, fontSize: "clamp(1.9rem,3vw,2.4rem)", letterSpacing: "-0.02em", margin: 0 }}>
          {greeting(now.getHours())}, {me.full_name.split(" ")[0]}
        </h1>
      </header>

      <section className={styles.stats} aria-label="Summary">
        <Link href="/student/attendance" className={`${styles.stat} ${overall !== null && overall < 75 ? styles.risk : ""}`}>
          <div className={styles.statTop}>
            <span className={styles.eyebrow}>Attendance</span>
            <Chevron />
          </div>
          <div className={styles.value}>
            {overall === null ? "—" : overall}
            {overall !== null && <small>%</small>}
          </div>
          <div className={styles.note}>
            {held ? <>{attended} of {held} classes · <b>{held - attended} missed</b></> : "nothing marked yet"}
          </div>
          <div className={styles.meter}><i style={{ width: `${overall ?? 0}%` }} /></div>
        </Link>

        <Link href="/student/attendance" className={`${styles.stat} ${short.length ? styles.risk : ""}`}>
          <div className={styles.statTop}>
            <span className={styles.eyebrow}>Subjects to watch</span>
            <Chevron />
          </div>
          <div className={styles.value}>{rows.length ? short.length : "—"}</div>
          <div className={styles.note}>
            {short.length ? short.map((s) => `${s.subject_code} · ${s.percentage}%`).join(", ") : "all above 75%"}
          </div>
        </Link>

        <Link href="/student/scorecard" className={styles.stat}>
          <div className={styles.statTop}>
            <span className={styles.eyebrow}>Scorecard</span>
            <Chevron />
          </div>
          <div className={styles.value}>{rows.length || "—"}<small> subjects</small></div>
          <div className={styles.note}>published assessments only</div>
        </Link>

        <Link href="/student/mentor" className={styles.stat}>
          <div className={styles.statTop}>
            <span className={styles.eyebrow}>Mentor</span>
            <Chevron />
          </div>
          <div className={styles.value} style={{ fontSize: "1.25rem", marginTop: 18 }}>
            {mentor ?? "Not assigned"}
          </div>
          <div className={`${styles.note} ${alerts.some((a) => a.urgent) ? styles.noteUrgent : ""}`}>
            {alerts.length
              ? <b>{alerts.length} thing{alerts.length === 1 ? "" : "s"} waiting on you</b>
              : mentor ? "nothing outstanding" : "the HOD assigns this"}
          </div>
        </Link>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h2 className={styles.cardTitle}>Timetable</h2>
            <p className={styles.cardSub}>
              {dow === 0
                ? "It's Sunday — nothing scheduled."
                : current
                  ? `Now in ${current.faculty_assignments.subjects.name}`
                  : upcoming
                    ? `Next: ${byPeriod.get(upcoming).faculty_assignments.subjects.name}, period ${upcoming}`
                    : "Nothing left today."}
            </p>
          </div>
        </div>

        {dow === 0 || (slots ?? []).length === 0 ? (
          <p className={styles.empty}>No classes scheduled today.</p>
        ) : (
          <div className={styles.tiles}>
            {periods.map((p) => {
              const slot = byPeriod.get(p);
              const isNow = p === nowPeriod && Boolean(slot);
              const isNext = p === upcoming;
              return (
                <div key={p} className={`${styles.tile} ${isNow ? styles.now : ""} ${slot ? "" : styles.free}`}>
                  <span className={styles.per}>P{p}</span>
                  {isNow && <span className={styles.badge}>Now</span>}
                  {isNext && <span className={`${styles.badge} ${styles.soon}`}>Next</span>}
                  <span className={styles.subj}>
                    {slot ? slot.faculty_assignments.subjects.name : "Free"}
                  </span>
                  <span className={styles.kind}>
                    {slot ? slot.faculty_assignments.subjects.code : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {alerts.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>From your mentor</h2>
              <p className={styles.cardSub}>Open until you acknowledge it.</p>
            </div>
            <Link href="/student/mentor" className={styles.more}>Open</Link>
          </div>

          <ul className={styles.alertList}>
            {alerts.slice(0, 3).map((a) => (
              <li key={a.id} className={styles.alertRow}>
                <span className={a.urgent ? styles.dotUrgent : styles.dot} aria-hidden="true" />
                <span className={styles.alertTitle}>{a.title}</span>
                <span className={styles.alertMeta}>
                  {a.kind === "meet" ? "Meeting" : "To do"}{a.due_text ? ` · ${a.due_text}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
