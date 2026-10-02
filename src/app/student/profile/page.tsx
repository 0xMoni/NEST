import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { SECTIONS, ALL_FIELDS } from "@/lib/profile-sections";
import { SectionCard, type Req } from "./SectionCard";

export default async function StudentProfile() {
  const me = await requireRole("student");
  const supabase = await createClient();

  const [{ data: profile }, { data: requests }, { data: mentorRow }] = await Promise.all([
    supabase.from("profiles").select(ALL_FIELDS.join(",")).eq("id", me.id).single(),
    supabase
      .from("profile_edit_requests")
      .select("id, section, status, expires_at")
      .eq("student_id", me.id)
      .order("requested_at", { ascending: false }),
    supabase
      .from("mentorships")
      .select("profiles!mentorships_mentor_id_fkey(full_name)")
      .eq("student_id", me.id)
      .maybeSingle(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mentor = (mentorRow as any)?.profiles?.full_name ?? null;

  // newest request per section wins
  const latest = new Map<string, Req>();
  for (const r of requests ?? []) {
    if (!latest.has(r.section)) latest.set(r.section, r as unknown as Req);
  }

  return (
    <Shell
      me={me}
      title="Profile"
      sub="Most of this is locked. Your mentor can open a section when something needs changing."
      wide
    >
      {SECTIONS.map((s) => (
        <SectionCard
          key={s.id}
          id={s.id}
          label={s.label}
          desc={s.desc}
          office={s.office}
          fields={s.fields}
          values={Object.fromEntries(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            s.fields.map((f) => [f.key, ((profile as any)?.[f.key] ?? "").toString()]),
          )}
          request={latest.get(s.id) ?? null}
          mentorName={mentor}
        />
      ))}
    </Shell>
  );
}
