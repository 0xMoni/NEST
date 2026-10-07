import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty } from "@/components/ui";
import { Editor, type Choice, type Filled } from "./Editor";

export default async function AdminTimetable({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const me = await requireRole("admin");
  const { section: chosen } = await searchParams;
  const supabase = await createClient();

  const { data: sections } = await supabase
    .from("sections")
    .select("id, dept, semester, name")
    .order("semester")
    .order("name");

  const list = sections ?? [];
  const active = list.find((s) => s.id === chosen) ?? list[0];

  let choices: Choice[] = [];
  let filled: Filled = {};

  if (active) {
    const { data: assignments } = await supabase
      .from("faculty_assignments")
      .select("id, subjects!inner(code, name), profiles!inner(full_name)")
      .eq("section_id", active.id);

    choices = (assignments ?? []).map((a) => ({
      id: a.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code: (a as any).subjects.code,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (a as any).subjects.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      who: (a as any).profiles.full_name,
    }));

    const ids = choices.map((c) => c.id);
    if (ids.length) {
      const { data: slots } = await supabase
        .from("timetable_slots")
        .select("day_of_week, period, assignment_id")
        .in("assignment_id", ids);
      filled = Object.fromEntries((slots ?? []).map((s) => [`${s.day_of_week}:${s.period}`, s.assignment_id]));
    }
  }

  return (
    <Shell
      me={me}
      title="Timetable"
      sub="Pick a class for each period. Faculty mark attendance straight from this, so an empty slot means no class to mark."
      wide
    >
      {list.length === 0 ? (
        <Empty>No sections exist yet. Create one on Sections &amp; subjects first.</Empty>
      ) : (
        <>
          <nav className={ui.tiles} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
            {list.map((s) => {
              const label = `${s.dept}-${s.semester}${s.name}`;
              const on = s.id === active?.id;
              return (
                <a
                  key={s.id}
                  href={`/admin/timetable?section=${s.id}`}
                  style={{
                    fontSize: "0.8125rem",
                    padding: "8px 15px",
                    borderRadius: 999,
                    textDecoration: "none",
                    border: `1px solid ${on ? "var(--ink)" : "var(--line)"}`,
                    color: on ? "var(--ink)" : "var(--ink-2)",
                    background: on ? "var(--field-2)" : "transparent",
                  }}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          {active && (
            <Editor
              sectionId={active.id}
              sectionLabel={`${active.dept}-${active.semester}${active.name}`}
              choices={choices}
              filled={filled}
            />
          )}
        </>
      )}
    </Shell>
  );
}
