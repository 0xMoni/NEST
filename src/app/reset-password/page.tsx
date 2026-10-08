import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ChangePassword } from "@/components/ChangePassword";
import styles from "../forgot-password/forgot.module.css";

/** Where the email link ends up, once /auth/confirm has traded the token
 *  for a session. Calls Supabase directly rather than requireUser: the
 *  session here exists only to set a password, and the gate would bounce
 *  anyone whose flag is still set straight back to /change-password. */
export default async function ResetPassword() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?expired=1");

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Image src="/nest-logo.png" alt="NEST" width={110} height={99} className={styles.logo} priority />

        <h1 className={styles.title}>Set a new password</h1>
        <p className={styles.lede}>
          This link signed you in. Choose a password and it will be the one you use from now on.
        </p>

        <ChangePassword usingDefault redirectTo="/dashboard" />
      </div>
    </main>
  );
}
