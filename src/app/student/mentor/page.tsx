import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty } from "@/components/ui";
import { Alerts, type Alert } from "./Alerts";
import styles from "./mentor.module.css";

export default async function StudentMentor() {
  const me = await requireRole("student");
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("mentorships")
    .select("profiles!mentorships_mentor_id_fkey(full_name, email, phone, cabin, office_hours)")
    .eq("student_id", me.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mentor = (link as any)?.profiles ?? null;

  const { data: rows } = await supabase
    .from("mentor_alerts")
    .select("id, kind, urgent, title, message, due_text, created_at, acknowledged_at")
    .order("acknowledged_at", { nullsFirst: true })
    .order("created_at", { ascending: false });

  const alerts = (rows ?? []) as Alert[];
  const open = alerts.filter((a) => !a.acknowledged_at).length;

  return (
    <Shell
      me={me}
      title="Mentor"
      sub={open ? `${open} thing${open === 1 ? "" : "s"} waiting on you.` : "Nothing outstanding."}
    >
      {!mentor ? (
        <Empty>No mentor has been assigned to you yet. The HOD sets this.</Empty>
      ) : (
        <section className={styles.card}>
          <span className={ui.label}>Your mentor</span>
          <h2 className={styles.name}>{mentor.full_name}</h2>
          <dl className={styles.contact}>
            {mentor.cabin && (
              <div><dt>Where</dt><dd>{mentor.cabin}</dd></div>
            )}
            {mentor.office_hours && (
              <div><dt>Hours</dt><dd>{mentor.office_hours}</dd></div>
            )}
            {mentor.email && (
              <div><dt>Email</dt><dd>{mentor.email}</dd></div>
            )}
            {mentor.phone && (
              <div><dt>Phone</dt><dd>{mentor.phone}</dd></div>
            )}
          </dl>
          {!mentor.cabin && !mentor.office_hours && (
            <p className={styles.thin}>
              They haven&apos;t added where to find them yet.
            </p>
          )}
        </section>
      )}

      <h2 className={ui.h2}>From your mentor</h2>
      <Alerts alerts={alerts} />
    </Shell>
  );
}
