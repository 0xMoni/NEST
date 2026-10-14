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
  mustChangePassword: boolean;
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
    .select("full_name, role, usn, dept, semester, email, must_change_password")
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
    mustChangePassword: profile?.must_change_password ?? false,
  };
}

/** requireUser, plus the gate.
 *
 *  Every page goes through this, so an account still on the password the
 *  office handed out cannot reach anything by typing a URL — the check is
 *  server side and runs before the page renders. /change-password calls
 *  requireUser directly, which is what keeps this from looping. */
export async function requireSettledUser(): Promise<Me> {
  const me = await requireUser();
  if (me.mustChangePassword) redirect("/change-password");
  return me;
}

/** Same, but refuses anyone outside the listed roles. A faculty member
 *  typing an admin URL gets bounced to their own home, not an error page. */
export async function requireRole(...allowed: Role[]): Promise<Me> {
  const me = await requireSettledUser();
  if (!allowed.includes(me.role)) redirect(homeFor(me.role));
  return me;
}

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "faculty" ? "/faculty" : "/student";
}
