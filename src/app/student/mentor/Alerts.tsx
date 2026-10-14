"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledge } from "./actions";
import styles from "./mentor.module.css";

export type Alert = {
  id: string;
  kind: "task" | "meet";
  urgent: boolean;
  title: string;
  message: string | null;
  due_text: string | null;
  created_at: string;
  acknowledged_at: string | null;
};

function when(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return `Today, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function Alerts({ alerts }: { alerts: Alert[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (alerts.length === 0) {
    return <p className={styles.none}>Nothing from your mentor right now.</p>;
  }

  return (
    <ul className={styles.alerts}>
      {alerts.map((a) => {
        const done = Boolean(a.acknowledged_at);
        return (
          <li key={a.id} className={`${styles.alert} ${a.urgent && !done ? styles.urgent : ""} ${done ? styles.done : ""}`}>
            <div className={styles.alertHead}>
              <span className={styles.kind}>{a.kind === "meet" ? "Meet" : "To do"}</span>
              {a.urgent && !done && <span className={styles.urgentTag}>Urgent</span>}
              <span className={styles.when}>{when(a.created_at)}</span>
            </div>

            <h3 className={styles.title}>{a.title}</h3>
            {a.message && <p className={styles.message}>{a.message}</p>}

            <div className={styles.alertFoot}>
              {a.due_text && <span className={styles.due}>{a.due_text}</span>}
              {done ? (
                <span className={styles.ack}>Acknowledged</span>
              ) : (
                <button
                  type="button"
                  className={styles.ackBtn}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await acknowledge(a.id);
                      router.refresh();
                    })
                  }
                >
                  Acknowledge
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
