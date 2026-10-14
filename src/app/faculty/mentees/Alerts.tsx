"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAlert, deleteAlert } from "@/app/faculty/actions";
import styles from "./mentees.module.css";

type Mentee = { id: string; full_name: string; usn: string | null };

export type SentAlert = {
  id: string;
  student_id: string;
  kind: "task" | "meet";
  urgent: boolean;
  title: string;
  due_text: string | null;
  created_at: string;
  acknowledged_at: string | null;
};

function on(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function Alerts({
  mentees,
  sent,
  preselect,
}: {
  mentees: Mentee[];
  sent: SentAlert[];
  preselect?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const name = new Map(mentees.map((m) => [m.id, m.full_name]));

  if (mentees.length === 0) return null;

  return (
    <section className={styles.alertsWrap}>
      <h2 className={styles.h2}>Send an alert</h2>
      <p className={styles.lede}>
        It shows up on your mentee&apos;s Mentor page until they acknowledge it.
      </p>

      <form
        ref={form}
        className={styles.compose}
        action={(fd) =>
          start(async () => {
            setError(null);
            const res = await createAlert(fd);
            if (res?.error) return setError(res.error);
            form.current?.reset();
            router.refresh();
          })
        }
      >
        <label className={styles.f}>
          <span>Student</span>
          <select name="student_id" defaultValue={preselect ?? ""} required>
            <option value="" disabled>Pick a mentee</option>
            {mentees.map((m) => (
              <option key={m.id} value={m.id}>
                {m.usn ? `${m.usn} — ` : ""}{m.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.f}>
          <span>Kind</span>
          <select name="kind" defaultValue="task">
            <option value="task">To do</option>
            <option value="meet">Meeting</option>
          </select>
        </label>

        <label className={`${styles.f} ${styles.wide}`}>
          <span>Title</span>
          <input name="title" placeholder="Attendance in BCS503 is short" maxLength={120} required />
        </label>

        <label className={`${styles.f} ${styles.wide}`}>
          <span>Message <i>optional</i></span>
          <textarea name="message" rows={2} placeholder="What should they do about it?" />
        </label>

        <label className={styles.f}>
          <span>When / due <i>optional</i></span>
          <input name="due_text" placeholder="Wed 8 Oct, 3:30 PM" maxLength={60} />
        </label>

        <label className={styles.check}>
          <input type="checkbox" name="urgent" />
          <span>Mark urgent</span>
        </label>

        <div className={styles.send}>
          <button type="submit" className={styles.approve} disabled={pending}>
            {pending ? "Sending…" : "Send alert"}
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </form>

      {sent.length > 0 && (
        <ul className={styles.sent}>
          {sent.map((a) => (
            <li key={a.id} className={styles.sentRow}>
              <div>
                <span className={styles.sentTo}>{name.get(a.student_id) ?? "Former mentee"}</span>
                <span className={styles.sentTitle}>{a.title}</span>
                <p className={styles.what}>
                  {a.kind === "meet" ? "Meeting" : "To do"}
                  {a.urgent && " · Urgent"}
                  {a.due_text && ` · ${a.due_text}`}
                  {` · sent ${on(a.created_at)}`}
                </p>
              </div>
              <div className={styles.actions}>
                <span className={a.acknowledged_at ? styles.seen : styles.unseen}>
                  {a.acknowledged_at ? "Acknowledged" : "Waiting"}
                </span>
                <button
                  type="button"
                  className={styles.deny}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await deleteAlert(a.id);
                      router.refresh();
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
