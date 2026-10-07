"use client";

import { useRef, useState, useTransition } from "react";
import { changePassword } from "@/lib/account";
import styles from "./change-password.module.css";

export function ChangePassword({ usingDefault }: { usingDefault: boolean }) {
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
