import Link from "next/link";
import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty, Badge } from "@/components/ui";
import { NewAssessment } from "./NewAssessment";

export default async function FacultyMarks() {
  const me = await requireRole("faculty");
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("faculty_assignments")
    .select("id, sections!inner(dept, semester, name), subjects!inner(code, name)");

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, max_marks, held_on, published, assignment_id, faculty_assignments!inner(subjects!inner(code, name))")
    .order("created_at", { ascending: false });

  const rows = assessments ?? [];

  return (
    <Shell me={me} title="Marks" sub="Create an assessment, enter scores, then publish it.">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <NewAssessment assignments={(assignments ?? []) as any} />

      <h2 className={ui.h2}>Your assessments</h2>
      {rows.length === 0 ? (
        <Empty>Nothing yet. Create one above and it appears here.</Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <thead>
              <tr><th>Assessment</th><th>Subject</th><th>Out of</th><th>Date</th><th>Visible to students</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fa = a.faculty_assignments as any;
                return (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td className={ui.dim}>{fa.subjects.code}</td>
                    <td className={ui.num}>{a.max_marks}</td>
                    <td className={ui.dim}>{a.held_on ?? "—"}</td>
                    <td><Badge tone={a.published ? "ok" : "muted"}>{a.published ? "Published" : "Draft"}</Badge></td>
                    <td><Link href={`/faculty/marks/${a.id}`}>Enter marks</Link></td>
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
