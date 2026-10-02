"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestEdit, withdrawRequest, saveSection } from "./actions";
import type { SectionId, Field } from "@/lib/profile-sections";
import styles from "./profile.module.css";

export type Req = { id: string; status: "pending" | "approved" | "rejected"; expires_at: string | null };

export function SectionCard({
  id,
  label,
  desc,
  office,
  fields,
  values,
  request,
  mentorName,
}: {
  id: SectionId;
  label: string;
  desc: string;
  office?: boolean;
  fields: Field[];
  values: Record<string, string>;
  request: Req | null;
  mentorName: string | null;
}) {
  const [draft, setDraft] = useState(values);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const open = request?.status === "approved" && request.expires_at && new Date(request.expires_at) > new Date();
  const waiting = request?.status === "pending";
  const editable = Boolean(open) && !office;

  const state = office ? "office" : open ? "unlocked" : waiting ? "pending" : "locked";

  return (
    <section className={`${styles.card} ${styles[state]}`}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>{label}</h2>
          <p className={styles.desc}>{desc}</p>
        </div>
        <span className={`${styles.state} ${styles[`s_${state}`]}`}>
          {office ? "College office" : open ? "Open for edits" : waiting ? "Awaiting mentor" : "Locked"}
        </span>
      </header>

      <div className={styles.fields}>
        {fields.map((f) => (
          <label key={f.key} className={styles.field}>
            {f.label}
            <input
              type={f.type ?? "text"}
              value={draft[f.key] ?? ""}
              disabled={!editable}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      {state === "office" && (
        <p className={styles.note}>The college office maintains these. Ask them if something is wrong.</p>
      )}

      {state === "locked" && !asking && (
        <div className={styles.foot}>
          <p className={styles.note}>
            This section is locked.{" "}
            {mentorName ? `Ask ${mentorName} to allow changes.` : "You have no mentor assigned yet."}
          </p>
          {mentorName && (
            <button type="button" className={styles.ghost} onClick={() => setAsking(true)}>
              Request edit access
            </button>
          )}
        </div>
      )}

      {state === "locked" && asking && (
        <div className={styles.foot}>
          <label className={styles.field}>
            What needs changing?
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Moved house, new address"
            />
          </label>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await requestEdit(id, reason);
                  if (res.error) return setError(res.error);
                  setAsking(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Sending…" : "Send request"}
            </button>
            <button type="button" className={styles.ghost} onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === "pending" && (
        <div className={styles.foot}>
          <p className={styles.note}>
            You&apos;ll be able to edit once {mentorName ?? "your mentor"} approves.
          </p>
          <button
            type="button"
            className={styles.ghost}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await withdrawRequest(request!.id);
                router.refresh();
              })
            }
          >
            Cancel request
          </button>
        </div>
      )}

      {state === "unlocked" && (
        <div className={styles.foot}>
          <p className={styles.noteOk}>
            {mentorName ? `${mentorName} has allowed edits` : "Edits allowed"} until{" "}
            {new Date(request!.expires_at!).toLocaleString("en-GB", {
              weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
            .
          </p>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  setSaved(false);
                  const res = await saveSection(id, draft);
                  if (res.error) return setError(res.error);
                  setSaved(true);
                  router.refresh();
                })
              }
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className={styles.noteOk}>All changes saved.</span>}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
