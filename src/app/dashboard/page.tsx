import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";

/** Placeholder dashboard. Its job for now is to prove the auth loop works
 *  end to end: cookie session → server read → profile row → role. The real
 *  screens get ported on top of this once that's confirmed. */
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The middleware already redirects signed-out visitors, but a page that
  // reads user data should never assume that ran.
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, usn, dept, semester")
    .eq("id", user.id)
    .single();

  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.kicker}>Signed in</p>
        <h1 className={styles.title}>{profile?.full_name || user.email}</h1>
        {profile?.role && <span className={styles.role}>{profile.role}</span>}
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        {profile?.usn && (
          <div>
            <dt>Roll number</dt>
            <dd>{profile.usn}</dd>
          </div>
        )}
        {profile?.dept && (
          <div>
            <dt>Department</dt>
            <dd>{profile.dept}</dd>
          </div>
        )}
        {profile?.semester && (
          <div>
            <dt>Semester</dt>
            <dd>{profile.semester}</dd>
          </div>
        )}
      </dl>

      {error && (
        <p className={styles.warn}>
          Signed in, but no profile row came back ({error.message}). That usually means the
          migration hasn&apos;t run, or row-level security is blocking the read.
        </p>
      )}

      <p className={styles.note}>
        Placeholder. The student dashboard, attendance and scorecard mockups still need porting
        onto this route.
      </p>

      <form action="/auth/signout" method="post">
        <button type="submit" className={styles.signout}>
          Sign out
        </button>
      </form>
    </main>
  );
}
