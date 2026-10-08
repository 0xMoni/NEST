"use client";

import { useState, useTransition } from "react";
import styles from "./forgot.module.css";

export function Form() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <p className={styles.sent}>
        If that account has an address on file, a link is on its way. It is good for one
        hour. Check the spam folder before trying again.
      </p>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const res = await fetch("/auth/forgot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: String(fd.get("identifier") ?? "") }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) return setError(body.error ?? "Something went wrong. Try again.");
          setSent(true);
        });
      }}
    >
      <label className={styles.field}>
        <span>USN or email</span>
        <input name="identifier" placeholder="1EP23CS001" autoComplete="username" required />
      </label>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Sending…" : "Send me a link"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
