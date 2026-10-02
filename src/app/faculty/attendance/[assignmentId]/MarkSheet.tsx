"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance } from "@/app/faculty/actions";
import styles from "./mark.module.css";

type Student = { id: string; full_name: string; usn: string | null };
type View = "usn" | "full";

/** Everyone in a section shares a USN prefix — 1EP23CS for all of 5A — so the
 *  only part worth reading is the tail. Dimming the shared half makes a grid
 *  of 60 scannable without making it ambiguous. */
function sharedPrefix(usns: string[]) {
  if (usns.length < 2) return "";
  let i = 0;
  while (i < usns[0].length && usns.every((u) => u[i] === usns[0][i])) i++;
  return usns[0].slice(0, i);
}

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
  // present, which is how a register is read out loud.
  const [absent, setAbsent] = useState<Set<string>>(new Set(initialAbsent));
  const [view, setView] = useState<View>("usn");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Remember the choice — a faculty member picks their way of working once.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("nest-roll-view");
      if (stored === "usn" || stored === "full") setView(stored);
    } catch {
      /* blocked storage — the default stands */
    }
  }, []);

  const choose = (next: View) => {
    setView(next);
    try {
      localStorage.setItem("nest-roll-view", next);
    } catch {
      /* not worth telling anyone about */
    }
  };

  const prefix = useMemo(
    () => sharedPrefix(students.map((s) => s.usn ?? "").filter(Boolean)),
    [students],
  );

  const toggle = (id: string) =>
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
          <strong>{students.length - absent.size}</strong> present ·{" "}
          <strong className={absent.size ? styles.absentCount : ""}>{absent.size}</strong> absent
        </span>

        <div className={styles.controls}>
          <div className={styles.segmented} role="group" aria-label="Roll display">
            <button type="button" aria-pressed={view === "usn"} onClick={() => choose("usn")}>
              USN only
            </button>
            <button type="button" aria-pressed={view === "full"} onClick={() => choose("full")}>
              USN &amp; name
            </button>
          </div>
          <button type="button" className={styles.ghost} onClick={() => setAbsent(new Set())}>
            Mark all present
          </button>
        </div>
      </div>

      <p className={styles.hint}>Tap a student to mark them absent.</p>

      <ul className={view === "usn" ? styles.gridUsn : styles.gridFull}>
        {students.map((s) => {
          const isAbsent = absent.has(s.id);
          const usn = s.usn ?? "";
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`${view === "usn" ? styles.chip : styles.card} ${isAbsent ? styles.absent : ""}`}
                onClick={() => toggle(s.id)}
                aria-pressed={isAbsent}
                aria-label={`${s.full_name}, ${isAbsent ? "absent" : "present"}`}
                title={s.full_name}
              >
                {view === "usn" ? (
                  <span className={styles.usnBig}>
                    <i>{prefix}</i>
                    {usn.slice(prefix.length)}
                  </span>
                ) : (
                  <>
                    <span className={styles.usnSmall}>{usn}</span>
                    <span className={styles.name}>{s.full_name}</span>
                    <span className={styles.state}>{isAbsent ? "Absent" : "Present"}</span>
                  </>
                )}
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
