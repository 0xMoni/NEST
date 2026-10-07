import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty, Badge, Bar } from "@/components/ui";
import { Requests, type PendingReq } from "./Requests";
import { Alerts, type SentAlert } from "./Alerts";
import { Contact } from "./Contact";
import Link from "next/link";
import styles from "./mentees.module.css";

export default async function Mentees({ searchParams }: PageProps<"/faculty/mentees">) {
  const to = (await searchParams).to;
  const me = await requireRole("faculty");
  const supabase = await createClient();

  const { data: mine } = await supabase
    .from("profiles")
    .select("cabin, office_hours, phone")
    .eq("id", me.id)
    .maybeSingle();

  const { data: links } = await supabase
    .from("mentorships")
    .select("student_id, profiles!mentorships_student_id_fkey(id, full_name, usn, semester)");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mentees = (links ?? []).map((l) => (l as any).profiles).filter(Boolean);

  // One query for everyone's attendance, then grouped here — a query per
  // mentee would be 24 round trips to render one page.
  const { data: att } = await supabase
    .from("v_student_attendance")
    .select("student_id, held, attended, short");

  // Requests from mentees waiting on this mentor. RLS limits it to their own.
  const { data: reqRows } = await supabase
    .from("profile_edit_requests")
    .select("id, section, reason, requested_at, profiles!profile_edit_requests_student_id_fkey(full_name, usn)")
    .eq("status", "pending")
    .order("requested_at");

  const requests: PendingReq[] = (reqRows ?? []).map((r) => ({
    id: r.id,
    section: r.section,
    reason: r.reason,
    requested_at: r.requested_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    student: (r as any).profiles?.full_name ?? "A student",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usn: (r as any).profiles?.usn ?? null,
  }));

  // Alerts this mentor has sent. RLS already scopes it to their own mentees.
  const { data: sentRows } = await supabase
    .from("mentor_alerts")
    .select("id, student_id, kind, urgent, title, due_text, created_at, acknowledged_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const sent = (sentRows ?? []) as SentAlert[];

  const summary = new Map<string, { held: number; attended: number; short: number }>();
  for (const r of att ?? []) {
    const s = summary.get(r.student_id) ?? { held: 0, attended: 0, short: 0 };
    s.held += Number(r.held ?? 0);
    s.attended += Number(r.attended ?? 0);
    if (r.short) s.short += 1;
    summary.set(r.student_id, s);
  }

  return (
    <Shell me={me} title="Mentees" sub={`${mentees.length} student${mentees.length === 1 ? "" : "s"} assigned to you.`}>
      <Requests requests={requests} />

      {mentees.length === 0 ? (
        <Empty>No students have been assigned to you as mentees yet. The HOD sets this.</Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <thead>
              <tr><th>USN</th><th>Name</th><th>Attendance</th><th></th><th>Subjects short</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {mentees
                .map((m) => ({ m, s: summary.get(m.id) }))
                .sort((a, b) => (b.s?.short ?? 0) - (a.s?.short ?? 0))
                .map(({ m, s }) => {
                  const pct = s?.held ? Math.round((1000 * s.attended) / s.held) / 10 : null;
                  const atRisk = (s?.short ?? 0) > 0;
                  return (
                    <tr key={m.id}>
                      <td className={ui.dim}>{m.usn}</td>
                      <td>{m.full_name}</td>
                      <td className={ui.num}>{pct === null ? "—" : `${pct}%`}</td>
                      <td><Bar value={pct} short={atRisk} /></td>
                      <td className={ui.num}>{s?.short ?? 0}</td>
                      <td>
                        {pct === null ? <Badge>No data</Badge> : <Badge tone={atRisk ? "bad" : "ok"}>{atRisk ? "Needs a word" : "Fine"}</Badge>}
                      </td>
                      <td>
                        <Link className={styles.rowAlert} href={`/faculty/mentees?to=${m.id}#alert`}>Alert</Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      <Contact cabin={mine?.cabin ?? null} officeHours={mine?.office_hours ?? null} phone={mine?.phone ?? null} />

      <div id="alert" />
      <Alerts
        mentees={mentees.map((m) => ({ id: m.id, full_name: m.full_name, usn: m.usn }))}
        sent={sent}
        preselect={typeof to === "string" ? to : undefined}
      />
    </Shell>
  );
}
