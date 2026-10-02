import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty, Badge } from "@/components/ui";

export default async function StudentScorecard() {
  const me = await requireRole("student");
  const supabase = await createClient();

  // The view already excludes unpublished assessments, so a half-entered IAT
  // cannot leak through here.
  const { data } = await supabase
    .from("v_student_scorecard")
    .select("subject_code, subject_name, title, scored, max_marks, percentage")
    .order("subject_code");

  const rows = data ?? [];
  const bySubject = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.subject_code}|${r.subject_name}`;
    bySubject.set(key, [...(bySubject.get(key) ?? []), r]);
  }

  return (
    <Shell me={me} title="Scorecard" sub="Only assessments your faculty have published.">
      {rows.length === 0 ? (
        <Empty>
          Nothing published yet. Marks appear here once a faculty member enters them and publishes the
          assessment — not before, so you never see a half-entered test.
        </Empty>
      ) : (
        [...bySubject.entries()].map(([key, items]) => {
          const [code, name] = key.split("|");
          const scored = items.reduce((n, r) => n + Number(r.scored ?? 0), 0);
          const out = items.reduce((n, r) => n + Number(r.max_marks ?? 0), 0);
          const pct = out ? Math.round((1000 * scored) / out) / 10 : 0;
          return (
            <section key={key}>
              <h2 className={ui.h2}>
                {name} <span className={ui.dim}>{code}</span>
              </h2>
              <div className={ui.scroll}>
                <table className={ui.table}>
                  <thead>
                    <tr><th>Assessment</th><th>Scored</th><th>Out of</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.title}>
                        <td>{r.title}</td>
                        <td className={ui.num}>{r.scored ?? "—"}</td>
                        <td className={ui.num}>{r.max_marks}</td>
                        <td className={ui.num}>{r.percentage ?? "—"}%</td>
                      </tr>
                    ))}
                    <tr>
                      <td><Badge tone={pct >= 40 ? "ok" : "bad"}>Total</Badge></td>
                      <td className={ui.num}>{scored}</td>
                      <td className={ui.num}>{out}</td>
                      <td className={ui.num}>{pct}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </Shell>
  );
}
