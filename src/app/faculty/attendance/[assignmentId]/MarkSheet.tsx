"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance } from "@/app/faculty/actions";
import styles from "./mark.module.css";

type Student = { id: string; full_name: string; usn: string | null };

export function MarkSheet({
  assignmentId,
  heldOn,
  period,
  students,
  initialAbsent,
  alreadyMarked,
}: {
  assignmentId: string;
  heldOn: string;
  period: number;
  students: Student[];
  initialAbsent: string[];
  alreadyMarked: boolean;
}) {
  // Absences are the exception, so that is what we track. Everyone starts
  // present, which is how a register is actually read out loud.
  const [absent, setAbsent] = useState<Set<string>>(new Set(initialAbsent));
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = (id: string) =>
    setAbsent((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveAttendance(
        assignmentId,
        heldOn,
        period,
        [...absent],
        students.map((s) => s.id),
      );
      if (res.error) return setError(res.error);
      setSaved(`${res.present} present, ${res.absent} absent`);
      router.refresh();
    });

  if (students.length === 0) {
    return <p className={styles.empty}>No students are enrolled in this section yet.</p>;
  }

  return (
    <div>
      <div className={styles.bar}>
        <span className={styles.count}>
          <strong>{students.length - absent.size}</strong> present · <strong>{absent.size}</strong> absent
        </span>
        <button type="button" className={styles.ghost} onClick={() => setAbsent(new Set())}>
          Mark all present
        </button>
      </div>

      <ul className={styles.list}>
        {students.map((s) => {
          const isAbsent = absent.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`${styles.student} ${isAbsent ? styles.absent : ""}`}
                onClick={() => toggle(s.id)}
                aria-pressed={isAbsent}
              >
                <span className={styles.usn}>{s.usn}</span>
                <span className={styles.name}>{s.full_name}</span>
                <span className={styles.state}>{isAbsent ? "Absent" : "Present"}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className={styles.error}>{error}</p>}
      {saved && <p className={styles.ok}>Saved — {saved}.</p>}

      <button type="button" className={styles.save} onClick={submit} disabled={pending}>
        {pending ? "Saving…" : alreadyMarked ? "Update attendance" : "Save attendance"}
      </button>
    </div>
  );
}
