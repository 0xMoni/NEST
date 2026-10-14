"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveContact } from "@/app/faculty/actions";
import styles from "./mentees.module.css";

export function Contact({
  cabin,
  officeHours,
  phone,
}: {
  cabin: string | null;
  officeHours: string | null;
  phone: string | null;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  return (
    <section className={styles.contact}>
      <h2 className={styles.h2}>Where your mentees can find you</h2>
      <p className={styles.lede}>This is what shows on their Mentor page.</p>

      <form
        className={styles.contactForm}
        action={(fd) =>
          start(async () => {
            const res = await saveContact(fd);
            setNote(res?.error ?? "Saved.");
            router.refresh();
          })
        }
      >
        <label className={styles.f}>
          <span>Cabin</span>
          <input name="cabin" defaultValue={cabin ?? ""} placeholder="214, Block B" maxLength={80} />
        </label>
        <label className={styles.f}>
          <span>Office hours</span>
          <input name="office_hours" defaultValue={officeHours ?? ""} placeholder="Mon, Wed 3:30–5:00 PM" maxLength={80} />
        </label>
        <label className={styles.f}>
          <span>Phone</span>
          <input name="phone" defaultValue={phone ?? ""} placeholder="Optional" maxLength={20} />
        </label>
        <div className={styles.send}>
          <button type="submit" className={styles.deny} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        {note && <p className={styles.note}>{note}</p>}
      </form>
    </section>
  );
}
