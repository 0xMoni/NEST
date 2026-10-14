import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty } from "@/components/ui";
import { AddSection, AddSubject, AddAssignment, RemoveAssignment } from "./Forms";

export default async function Structure() {
  const me = await requireRole("admin");
  const supabase = await createClient();

  const [{ data: sections }, { data: subjects }, { data: assignments }] = await Promise.all([
    supabase.from("sections").select("id, dept, semester, name").order("semester").order("name"),
    supabase.from("subjects").select("id, code, name, semester, credits").order("semester").order("code"),
    supabase
      .from("faculty_assignments")
      .select("id, sections!inner(dept, semester, name), subjects!inner(code, name), profiles!inner(full_name)"),
  ]);

  const { data: faculty } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "faculty")
    .order("full_name");

  const { data: enrolment } = await supabase.from("section_students").select("section_id");
  const size = new Map<string, number>();
  for (const e of enrolment ?? []) size.set(e.section_id, (size.get(e.section_id) ?? 0) + 1);

  return (
    <Shell me={me} title="Sections & subjects" sub="The structure everything else hangs off. Nothing below this works until it exists." wide>
      <h2 className={ui.h2}>Sections</h2>
      <AddSection />
      {(sections ?? []).length === 0 ? (
        <Empty>No sections yet.</Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <thead><tr><th>Section</th><th>Department</th><th>Semester</th><th>Students</th></tr></thead>
            <tbody>
              {(sections ?? []).map((s) => (
                <tr key={s.id}>
                  <td><b>{s.dept}-{s.semester}{s.name}</b></td>
                  <td className={ui.dim}>{s.dept}</td>
                  <td className={ui.num}>{s.semester}</td>
                  <td className={ui.num}>{size.get(s.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={ui.h2}>Subjects</h2>
      <AddSubject />
      {(subjects ?? []).length === 0 ? (
        <Empty>No subjects yet.</Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <thead><tr><th>Code</th><th>Subject</th><th>Semester</th><th>Credits</th></tr></thead>
            <tbody>
              {(subjects ?? []).map((s) => (
                <tr key={s.id}>
                  <td className={ui.dim}>{s.code}</td>
                  <td>{s.name}</td>
                  <td className={ui.num}>{s.semester}</td>
                  <td className={ui.num}>{s.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={ui.h2}>Who teaches what</h2>
      <AddAssignment
        sections={(sections ?? []).map((s) => ({ id: s.id, label: `${s.dept}-${s.semester}${s.name}` }))}
        subjects={(subjects ?? []).map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }))}
        faculty={(faculty ?? []).map((f) => ({ id: f.id, label: f.full_name }))}
      />
      {(assignments ?? []).length === 0 ? (
        <Empty>Nothing assigned. Until a faculty member is assigned to a subject in a section, they cannot mark attendance for it.</Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <thead><tr><th>Section</th><th>Subject</th><th>Faculty</th><th></th></tr></thead>
            <tbody>
              {(assignments ?? []).map((a) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const x = a as any;
                return (
                  <tr key={a.id}>
                    <td className={ui.dim}>{x.sections.dept}-{x.sections.semester}{x.sections.name}</td>
                    <td>{x.subjects.name} <span className={ui.dim}>{x.subjects.code}</span></td>
                    <td>{x.profiles.full_name}</td>
                    <td><RemoveAssignment id={a.id} /></td>
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
