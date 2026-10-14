import { requireRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { ui, Empty, Badge, Tile } from "@/components/ui";
import { NewPerson } from "./NewPerson";

export default async function People() {
  const me = await requireRole("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, usn, email, dept, semester")
    .order("role")
    .order("usn", { nullsFirst: false });

  const people = data ?? [];
  const count = (r: string) => people.filter((p) => p.role === r).length;

  return (
    <Shell me={me} title="People" sub="Everyone with an account. Creating one is how a student gets in.">
      <div className={ui.tiles}>
        <Tile label="Students" value={count("student")} />
        <Tile label="Faculty" value={count("faculty")} />
        <Tile label="Admins" value={count("admin")} foot="department head" />
      </div>

      <NewPerson />

      <h2 className={ui.h2}>All accounts</h2>
      {people.length === 0 ? (
        <Empty>Nobody yet.</Empty>
      ) : (
        <div className={ui.scroll}>
          <table className={ui.table}>
            <thead><tr><th>USN</th><th>Name</th><th>Role</th><th>Email</th><th>Sem</th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td className={ui.dim}>{p.usn ?? "—"}</td>
                  <td>{p.full_name}</td>
                  <td><Badge tone={p.role === "admin" ? "bad" : p.role === "faculty" ? "ok" : "muted"}>{p.role}</Badge></td>
                  <td className={ui.dim}>{p.email}</td>
                  <td className={ui.num}>{p.semester ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
