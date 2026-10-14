"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSlot } from "@/app/admin/actions";
import { PERIODS, BREAK_AFTER } from "@/lib/periods";
import styles from "./editor.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type Choice = { id: string; code: string; name: string; who: string };
export type Filled = Record<string, string>; // "day:period" -> assignment id

export function Editor({
  sectionId,
  sectionLabel,
  choices,
  filled,
}: {
  sectionId: string;
  sectionLabel: string;
  choices: Choice[];
  filled: Filled;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  if (choices.length === 0) {
    return (
      <p className={styles.hint}>
        No subjects are assigned to {sectionLabel} yet. Assign a faculty member to a subject on
        Sections &amp; subjects first — the timetable can only hold classes that someone teaches.
      </p>
    );
  }

  const change = (day: number, period: number, value: string) =>
    start(async () => {
      setError(null);
      setBusy(`${day}:${period}`);
      const res = await setSlot(day, period, value || null, sectionId);
      setBusy(null);
      if (res?.error) return setError(res.error);
      router.refresh();
    });

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.wrap}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th />
              {PERIODS.map((p) => (
                <th key={p.n}>
                  <span className={styles.pNum}>P{p.n}</span>
                  <span className={styles.pTime}>{p.from}</span>
                  {BREAK_AFTER[p.n as keyof typeof BREAK_AFTER] && (
                    <span className={styles.after}>
                      {BREAK_AFTER[p.n as keyof typeof BREAK_AFTER]} after
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((label, i) => {
              const day = i + 1;
              return (
                <tr key={label}>
                  <th scope="row" className={styles.day}>{label}</th>
                  {PERIODS.map((p) => {
                    const key = `${day}:${p.n}`;
                    return (
                      <td key={p.n}>
                        <select
                          className={`${styles.pick} ${filled[key] ? styles.set : ""}`}
                          value={filled[key] ?? ""}
                          disabled={busy === key}
                          aria-label={`${label} period ${p.n}`}
                          onChange={(e) => change(day, p.n, e.target.value)}
                        >
                          <option value="">Free</option>
                          {choices.map((c) => (
                            <option key={c.id} value={c.id}>{c.code}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.key}>
        {choices.map((c) => (
          <span key={c.id} className={styles.keyItem}>
            <b>{c.code}</b> {c.name} <span>{c.who}</span>
          </span>
        ))}
      </div>
    </>
  );
}
