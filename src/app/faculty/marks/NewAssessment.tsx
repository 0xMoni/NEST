"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssessment } from "@/app/faculty/actions";
import styles from "./marks.module.css";

type Assignment = {
  id: string;
  sections: { dept: string; semester: number; name: string };
  subjects: { code: string; name: string };
};

export function NewAssessment({ assignments }: { assignments: Assignment[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (assignments.length === 0) return null;

  return (
    <div className={styles.new}>
      {!open ? (
        <button type="button" className={styles.primary} onClick={() => setOpen(true)}>
          New assessment
        </button>
      ) : (
        <form
          ref={form}
          className={styles.form}
          action={(fd) =>
            start(async () => {
              setError(null);
              const res = await createAssessment(fd);
              if (res.error) return setError(res.error);
              form.current?.reset();
              setOpen(false);
              router.refresh();
            })
          }
        >
          <label>
            Subject
            <select name="assignment_id" required>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.subjects.code} — {a.subjects.name} ({a.sections.dept}-{a.sections.semester}
                  {a.sections.name})
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input name="title" required placeholder="IAT 1" />
          </label>
          <label>
            Out of
            <input name="max_marks" type="number" min="1" step="0.5" required defaultValue={50} />
          </label>
          <label>
            Date
            <input name="held_on" type="date" />
          </label>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </button>
            <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      )}
    </div>
  );
}
