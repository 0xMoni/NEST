"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMarks, setPublished } from "@/app/faculty/actions";
import styles from "./entry.module.css";

type Student = { id: string; full_name: string; usn: string | null };

export function MarkEntry({
  assessmentId,
  maxMarks,
  published,
  students,
  initial,
}: {
  assessmentId: string;
  maxMarks: number;
  published: boolean;
  students: Student[];
  initial: Record<string, number | null>;
}) {
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.id, initial[s.id]?.toString() ?? ""])),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const entered = Object.values(scores).filter((v) => v !== "").length;
  const overMax = Object.values(scores).some((v) => v !== "" && Number(v) > maxMarks);

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveMarks(
        assessmentId,
        students.map((s) => ({
          student_id: s.id,
          scored: scores[s.id] === "" ? null : Number(scores[s.id]),
        })),
      );
      if (res.error) return setError(res.error);
      setMsg(`Saved ${entered} of ${students.length}.`);
      router.refresh();
    });

  const publish = () =>
    start(async () => {
      setError(null);
      const res = await setPublished(assessmentId, !published);
      if (res.error) return setError(res.error);
      router.refresh();
    });

  if (students.length === 0) return <p className={styles.empty}>No students in this section.</p>;

  return (
    <div>
      <div className={styles.bar}>
        <span className={styles.count}>
          <strong>{entered}</strong> of {students.length} entered
        </span>
        <button type="button" className={published ? styles.ghost : styles.primary} onClick={publish} disabled={pending}>
          {published ? "Unpublish" : "Publish to students"}
        </button>
      </div>

      {published && (
        <p className={styles.note}>
          Students can see these marks right now. Any edit you save is visible immediately.
        </p>
      )}

      <ul className={styles.list}>
        {students.map((s) => (
          <li key={s.id} className={styles.row}>
            <span className={styles.usn}>{s.usn}</span>
            <span className={styles.name}>{s.full_name}</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              max={maxMarks}
              step="0.5"
              inputMode="decimal"
              value={scores[s.id]}
              aria-label={`Marks for ${s.full_name}`}
              aria-invalid={scores[s.id] !== "" && Number(scores[s.id]) > maxMarks}
              onChange={(e) => setScores((p) => ({ ...p, [s.id]: e.target.value }))}
            />
            <span className={styles.outof}>/ {maxMarks}</span>
          </li>
        ))}
      </ul>

      {overMax && <p className={styles.error}>Some scores are above the maximum of {maxMarks}.</p>}
      {error && <p className={styles.error}>{error}</p>}
      {msg && <p className={styles.ok}>{msg}</p>}

      <button type="button" className={styles.primary} onClick={save} disabled={pending || overMax}>
        {pending ? "Saving…" : "Save marks"}
      </button>
    </div>
  );
}
