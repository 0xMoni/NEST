import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "student" | "faculty" | "admin";

export type Me = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  usn: string | null;
  dept: string | null;
  semester: number | null;
};

/** The signed-in person and their profile, or a redirect to /login.
 *
 *  Pages call this rather than reading auth themselves: the middleware
 *  already gates routes, but a page that renders someone's data should
 *  never assume the middleware ran. */
export async function requireUser(): Promise<Me> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, usn, dept, semester, email")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    full_name: profile?.full_name || (user.email ?? ""),
    role: (profile?.role as Role) ?? "student",
    usn: profile?.usn ?? null,
    dept: profile?.dept ?? null,
    semester: profile?.semester ?? null,
  };
}

/** Same, but refuses anyone outside the listed roles. A faculty member
 *  typing an admin URL gets bounced to their own home, not an error page. */
export async function requireRole(...allowed: Role[]): Promise<Me> {
  const me = await requireUser();
  if (!allowed.includes(me.role)) redirect(homeFor(me.role));
  return me;
}

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "faculty" ? "/faculty" : "/student";
}
