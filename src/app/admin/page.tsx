import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Tile, Empty } from "@/components/ui";

export default async function AdminHome() {
  const me = await requireRole("admin");
  const supabase = await createClient();

  const [{ data: people }, { data: sections }, { data: subjects }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("role"),
    supabase.from("sections").select("id"),
    supabase.from("subjects").select("id"),
    supabase.from("attendance_sessions").select("id, held_on"),
  ]);

  const count = (r: string) => (people ?? []).filter((p) => p.role === r).length;
  const today = new Date().toISOString().slice(0, 10);
  const markedToday = (sessions ?? []).filter((s) => s.held_on === today).length;

  return (
    <Shell me={me} title="Overview" sub="The department at a glance.">
      <div className={ui.tiles}>
        <Tile label="Students" value={count("student")} />
        <Tile label="Faculty" value={count("faculty")} />
        <Tile label="Sections" value={(sections ?? []).length} foot={`${(subjects ?? []).length} subjects`} />
        <Tile label="Classes marked today" value={markedToday} foot={`${(sessions ?? []).length} all time`} />
      </div>

      {(sessions ?? []).length === 0 && (
        <Empty>
          No attendance has been marked yet. Once faculty start marking classes, this is where you will
          see whether they actually are.
        </Empty>
      )}
    </Shell>
  );
}
