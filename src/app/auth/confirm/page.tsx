import Image from "next/image";
import { redirect } from "next/navigation";
import { confirmToken } from "./actions";
import styles from "../../forgot-password/forgot.module.css";

/** The landing page for the link in a reset email.
 *
 *  This used to verify the token on GET, which cost us an afternoon: these
 *  tokens are strictly single use, and the link never reaches the student
 *  untouched. Brevo rewrites it for click tracking, Gmail scans it, the
 *  browser may prefetch it — Brevo's own dashboard recorded two clicks on a
 *  link that had been clicked once. Whichever machine got there first spent
 *  the token, and the person arrived to be told it had already been used.
 *
 *  So nothing happens until someone presses a button. Scanners follow links;
 *  they do not submit forms. Brevo does not allow click tracking to be turned
 *  off below its enterprise plans, so this is the side of it we control. */
export default async function Confirm({ searchParams }: PageProps<"/auth/confirm">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const tokenHash = one(sp.token_hash);
  const code = one(sp.code);
  const next = one(sp.next) || "/reset-password";

  if (!tokenHash && !code) redirect("/forgot-password?expired=1");

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Image src="/nest-logo.png" alt="NEST" width={110} height={99} className={styles.logo} priority />

        <h1 className={styles.title}>One more tap</h1>
        <p className={styles.lede}>
          You asked to reset your NEST password. Continue, and you can choose a new one.
        </p>

        <form action={confirmToken} className={styles.form}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={styles.submit}>Continue</button>
        </form>

        <p className={styles.back}>
          Didn&apos;t ask for this? Close the page and nothing changes.
        </p>
      </div>
    </main>
  );
}
