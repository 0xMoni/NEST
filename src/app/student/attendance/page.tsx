import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty, Tile, Badge, Bar } from "@/components/ui";

export default async function StudentAttendance() {
  const me = await requireRole("student");
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_student_attendance")
    .select("subject_code, subject_name, held, attended, percentage, short")
    .order("percentage", { ascending: true });

  const rows = data ?? [];
  const held = rows.reduce((n, r) => n + Number(r.held ?? 0), 0);
  const attended = rows.reduce((n, r) => n + Number(r.attended ?? 0), 0);
  const overall = held ? Math.round((1000 * attended) / held) / 10 : null;
  const short = rows.filter((r) => r.short);

  return (
    <Shell me={me} title="Attendance" sub="Per subject, and where you stand against the 75% rule.">
      <div className={ui.tiles}>
        <Tile label="Overall" value={overall === null ? "—" : `${overall}%`} foot={held ? `${attended} of ${held} classes` : "nothing marked yet"} />
        <Tile label="Classes missed" value={held ? held - attended : "—"} foot="across all subjects" />
        <Tile
          label="Below 75%"
          value={rows.length ? short.length : "—"}
          foot={short.length ? short.map((s) => s.subject_code).join(", ") : "all on track"}
        />
      </div>

      {rows.length === 0 ? (
        <Empty>
          Nothing has been marked yet. Your attendance appears here as soon as a faculty member marks
          their first class.
        </Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Code</th><th>Subject</th><th>Held</th><th>Attended</th><th>Missed</th><th></th><th>%</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subject_code}>
                  <td className={ui.dim}>{r.subject_code}</td>
                  <td>{r.subject_name}</td>
                  <td className={ui.num}>{r.held}</td>
                  <td className={ui.num}>{r.attended}</td>
                  <td className={ui.num}>{Number(r.held) - Number(r.attended)}</td>
                  <td><Bar value={Number(r.percentage)} short={Boolean(r.short)} /></td>
                  <td className={ui.num}>{r.percentage}%</td>
                  <td><Badge tone={r.short ? "bad" : "ok"}>{r.short ? "Short" : "On track"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
