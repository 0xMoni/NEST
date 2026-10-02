import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Badge } from "@/components/ui";
import { ChangePassword } from "./ChangePassword";
import styles from "./profile.module.css";

const ROLE_LABEL = { student: "Student", faculty: "Faculty", admin: "HOD / DOE" } as const;

export default async function Profile() {
  const me = await requireUser();
  const supabase = await createClient();

  // Who mentors this student, or who this faculty member mentors.
  let mentor: string | null = null;
  let menteeCount = 0;
  let teaches: { code: string; name: string; section: string }[] = [];
  let section: string | null = null;

  if (me.role === "student") {
    const { data } = await supabase
      .from("mentorships")
      .select("profiles!mentorships_mentor_id_fkey(full_name)")
      .eq("student_id", me.id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mentor = (data as any)?.profiles?.full_name ?? null;

    const { data: enrol } = await supabase
      .from("section_students")
      .select("sections!inner(dept, semester, name)")
      .eq("student_id", me.id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (enrol as any)?.sections;
    section = s ? `${s.dept}-${s.semester}${s.name}` : null;
  }

  if (me.role === "faculty") {
    const { count } = await supabase
      .from("mentorships")
      .select("*", { count: "exact", head: true })
      .eq("mentor_id", me.id);
    menteeCount = count ?? 0;

    const { data } = await supabase
      .from("faculty_assignments")
      .select("sections!inner(dept, semester, name), subjects!inner(code, name)")
      .eq("faculty_id", me.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teaches = (data ?? []).map((a: any) => ({
      code: a.subjects.code,
      name: a.subjects.name,
      section: `${a.sections.dept}-${a.sections.semester}${a.sections.name}`,
    }));
  }

  const rows: [string, React.ReactNode][] = [
    ["Name", me.full_name],
    ["Role", <Badge key="r" tone={me.role === "admin" ? "bad" : me.role === "faculty" ? "ok" : "muted"}>{ROLE_LABEL[me.role]}</Badge>],
    ...(me.usn ? ([["USN", me.usn]] as [string, React.ReactNode][]) : []),
    ["Email", me.email ?? "—"],
    ...(me.dept ? ([["Department", me.dept]] as [string, React.ReactNode][]) : []),
    ...(me.semester ? ([["Semester", String(me.semester)]] as [string, React.ReactNode][]) : []),
    ...(section ? ([["Section", section]] as [string, React.ReactNode][]) : []),
    ...(me.role === "student" ? ([["Mentor", mentor ?? "Not assigned yet"]] as [string, React.ReactNode][]) : []),
    ...(me.role === "faculty" ? ([["Mentees", `${menteeCount} student${menteeCount === 1 ? "" : "s"}`]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <Shell me={me} title="Profile" sub="Your details, and the only thing here you can change.">
      <dl className={styles.facts}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {me.role === "faculty" && teaches.length > 0 && (
        <>
          <h2 className={ui.h2}>What you teach</h2>
          <div className={ui.scroll}>
            <table className={ui.table}>
              <thead><tr><th>Code</th><th>Subject</th><th>Section</th></tr></thead>
              <tbody>
                {teaches.map((t) => (
                  <tr key={`${t.code}-${t.section}`}>
                    <td className={ui.dim}>{t.code}</td>
                    <td>{t.name}</td>
                    <td className={ui.dim}>{t.section}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className={ui.h2}>Password</h2>
      <p className={styles.note}>
        Every account is created with the same starting password. Changing yours is what stops it
        being a password at all.
      </p>
      <ChangePassword usingDefault={false} />
    </Shell>
  );
}
