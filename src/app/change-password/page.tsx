import { redirect } from "next/navigation";
import Image from "next/image";
import { requireUser, homeFor } from "@/lib/session";
import { ChangePassword } from "@/components/ChangePassword";
import styles from "./gate.module.css";

/** The one page that calls requireUser rather than requireSettledUser.
 *  Gating it would send it to itself. */
export default async function ChangePasswordGate() {
  const me = await requireUser();
  if (!me.mustChangePassword) redirect(homeFor(me.role));

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Image src="/nest-logo.png" alt="NEST" width={120} height={48} className={styles.logo} priority />

        <h1 className={styles.title}>Pick a password</h1>
        <p className={styles.lede}>
          Your account was created on the password the office gives everyone, and your USN is on
          the noticeboard. Choose your own before you go any further.
        </p>

        <ChangePassword usingDefault redirectTo={homeFor(me.role)} />

        <p className={styles.who}>
          Signed in as {me.full_name}
          {me.usn ? ` · ${me.usn}` : ""}
        </p>
      </div>
    </main>
  );
}
