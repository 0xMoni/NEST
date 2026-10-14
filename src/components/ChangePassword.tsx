"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/lib/account";
import styles from "./change-password.module.css";

export function ChangePassword({
  usingDefault,
  redirectTo,
}: {
  usingDefault: boolean;
  /** Where to go once it is set. Given only by the gate, where staying put
   *  would leave someone on a page with no way out. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(usingDefault);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  if (done) return <p className={styles.ok}>Password changed. Use the new one next time you sign in.</p>;

  if (!open) {
    return (
      <button type="button" className={styles.ghost} onClick={() => setOpen(true)}>
        Change password
      </button>
    );
  }

  return (
    <form
      ref={form}
      className={styles.pwForm}
      action={(fd) =>
        start(async () => {
          setError(null);
          const res = await changePassword(fd);
          if (res.error) return setError(res.error);
          if (redirectTo) {
            router.replace(redirectTo);
            router.refresh();
            return;
          }
          setDone(true);
        })
      }
    >
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" required minLength={6} />
      </label>
      <label>
        Again
        <input name="confirm" type="password" autoComplete="new-password" required minLength={6} />
      </label>
      <div className={styles.row}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </button>
        {!usingDefault && (
          <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
