"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSection, createSubject, createAssignment, removeAssignment } from "@/app/admin/actions";
import styles from "./structure.module.css";

type Opt = { id: string; label: string };

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) return setError(res.error);
      after?.();
      router.refresh();
    });
  return { error, pending, run };
}

export function AddSubject() {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const { error, pending, run } = useAction();

  if (!open) return <button className={styles.add} onClick={() => setOpen(true)}>Add subject</button>;

  return (
    <form ref={form} className={styles.form} action={(fd) => run(() => createSubject(fd), () => { form.current?.reset(); setOpen(false); })}>
      <label>Code<input name="code" required placeholder="BCS501" /></label>
      <label>Name<input name="name" required placeholder="Machine Learning" /></label>
      <label>Semester<input name="semester" type="number" min="1" max="8" required defaultValue={5} /></label>
      <label>Credits<input name="credits" type="number" min="1" max="6" defaultValue={4} /></label>
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>{pending ? "Adding…" : "Add"}</button>
        <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}

export function AddSection() {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const { error, pending, run } = useAction();

  if (!open) return <button className={styles.add} onClick={() => setOpen(true)}>Add section</button>;

  return (
    <form ref={form} className={styles.form} action={(fd) => run(() => createSection(fd), () => { form.current?.reset(); setOpen(false); })}>
      <label>Department<input name="dept" required defaultValue="CSE" /></label>
      <label>Semester<input name="semester" type="number" min="1" max="8" required defaultValue={5} /></label>
      <label>Section<input name="name" required placeholder="A" maxLength={2} /></label>
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>{pending ? "Adding…" : "Add"}</button>
        <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}

export function AddAssignment({ sections, subjects, faculty }: { sections: Opt[]; subjects: Opt[]; faculty: Opt[] }) {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const { error, pending, run } = useAction();

  if (sections.length === 0 || subjects.length === 0 || faculty.length === 0) {
    return (
      <p className={styles.hint}>
        Needs at least one section, one subject and one faculty account before anyone can be assigned.
      </p>
    );
  }

  if (!open) return <button className={styles.add} onClick={() => setOpen(true)}>Assign a subject</button>;

  return (
    <form ref={form} className={styles.form} action={(fd) => run(() => createAssignment(fd), () => { form.current?.reset(); setOpen(false); })}>
      <label>Section<select name="section_id">{sections.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <label>Subject<select name="subject_id">{subjects.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <label>Faculty<select name="faculty_id">{faculty.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>{pending ? "Assigning…" : "Assign"}</button>
        <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}

export function RemoveAssignment({ id }: { id: string }) {
  const { error, pending, run } = useAction();
  return (
    <>
      <button className={styles.remove} disabled={pending} onClick={() => run(() => removeAssignment(id))}>
        Remove
      </button>
      {error && <span className={styles.inlineError}>{error}</span>}
    </>
  );
}
