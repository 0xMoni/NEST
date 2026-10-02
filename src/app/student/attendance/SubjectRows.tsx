"use client";

import { useState } from "react";
import { ui, Badge, Bar } from "@/components/ui";
import styles from "./attendance.module.css";

export type Session = { held_on: string; period: number; missed: boolean };
export type Subject = {
  code: string;
  name: string;
  held: number;
  attended: number;
  percentage: number;
  short: boolean;
  sessions: Session[];
};

type Range = "week" | "sem";

/** Prithika's idea, on our table: a percentage tells you there is a problem,
 *  the individual classes tell you which ones. */
export function SubjectRows({ subjects }: { subjects: Subject[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("week");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  return (
    <div className={ui.scroll}>
      <table className={ui.table}>
        <thead>
          <tr>
            <th>Code</th><th>Subject</th><th>Held</th><th>Attended</th><th>Missed</th><th></th><th>%</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => {
            const isOpen = open === s.code;
            const shown = range === "week"
              ? s.sessions.filter((x) => new Date(x.held_on) >= cutoff)
              : s.sessions;
            const missedShown = shown.filter((x) => x.missed).length;

            return (
              <>
                <tr key={s.code}>
                  <td className={ui.dim}>{s.code}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.expand}
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : s.code)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                      {s.name}
                    </button>
                  </td>
                  <td className={ui.num}>{s.held}</td>
                  <td className={ui.num}>{s.attended}</td>
                  <td className={ui.num}>{s.held - s.attended}</td>
                  <td><Bar value={s.percentage} short={s.short} /></td>
                  <td className={ui.num}>{s.percentage}%</td>
                  <td><Badge tone={s.short ? "bad" : "ok"}>{s.short ? "Short" : "On track"}</Badge></td>
                </tr>

                {isOpen && (
                  <tr key={`${s.code}-detail`} className={styles.detailRow}>
                    <td colSpan={8}>
                      <div className={styles.detailHead}>
                        <span className={missedShown ? styles.missSummary : styles.okSummary}>
                          {shown.length === 0
                            ? "No classes in this range."
                            : missedShown === 0
                              ? `Present for all ${shown.length}.`
                              : `Missed ${missedShown} of ${shown.length}.`}
                        </span>
                        <div className={styles.seg} role="group" aria-label="Range">
                          <button type="button" aria-pressed={range === "week"} onClick={() => setRange("week")}>
                            Last 7 days
                          </button>
                          <button type="button" aria-pressed={range === "sem"} onClick={() => setRange("sem")}>
                            Whole semester
                          </button>
                        </div>
                      </div>

                      <ul className={`${styles.classes} ${range === "sem" ? styles.dense : ""}`}>
                        {shown.map((c) => (
                          <li key={`${c.held_on}-${c.period}`} className={c.missed ? styles.missed : styles.present}>
                            <b>{new Date(c.held_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b>
                            <span>P{c.period}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
