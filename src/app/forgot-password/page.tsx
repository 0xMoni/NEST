import Link from "next/link";
import Image from "next/image";
import { Form } from "./Form";
import styles from "./forgot.module.css";

export default async function ForgotPassword({ searchParams }: PageProps<"/forgot-password">) {
  const expired = (await searchParams).expired;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Image src="/nest-logo.png" alt="NEST" width={110} height={99} className={styles.logo} priority />

        <h1 className={styles.title}>Forgot your password</h1>
        <p className={styles.lede}>
          We will email a link to the address the college has on file for you. Sign in with
          your USN afterwards as usual.
        </p>

        {expired && (
          <p className={styles.expired}>
            That link has already been used or has expired. Ask for a new one.
          </p>
        )}

        <Form />

        <p className={styles.back}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
