"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideEditRequest } from "@/app/faculty/actions";
import styles from "./mentees.module.css";

export type PendingReq = {
  id: string;
  section: string;
  reason: string | null;
  requested_at: string;
  student: string;
  usn: string | null;
};

const LABEL: Record<string, string> = {
  student: "Student details",
  parent: "Parent details",
  guardian: "Guardian details",
  contact: "Contact details",
  admission: "Admission details",
  academic: "Academic details",
};

export function Requests({ requests }: { requests: PendingReq[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (requests.length === 0) return null;

  const decide = (id: string, approve: boolean) =>
    start(async () => {
      await decideEditRequest(id, approve);
      router.refresh();
    });

  return (
    <section className={styles.requests}>
      <h2 className={styles.h2}>
        Waiting on you <span className={styles.count}>{requests.length}</span>
      </h2>
      <ul className={styles.list}>
        {requests.map((r) => (
          <li key={r.id} className={styles.req}>
            <div>
              <b>{r.student}</b> <span className={styles.usn}>{r.usn}</span>
              <p className={styles.what}>
                wants to edit <b>{LABEL[r.section] ?? r.section}</b>
                {r.reason ? ` — “${r.reason}”` : ""}
              </p>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.approve} disabled={pending} onClick={() => decide(r.id, true)}>
                Allow for 48 hours
              </button>
              <button type="button" className={styles.deny} disabled={pending} onClick={() => decide(r.id, false)}>
                Refuse
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
