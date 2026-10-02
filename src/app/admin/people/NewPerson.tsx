"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPerson } from "@/app/admin/actions";
import styles from "@/app/faculty/marks/marks.module.css";

export function NewPerson() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("student");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!open) {
    return (
      <div>
        <button type="button" className={styles.primary} onClick={() => setOpen(true)}>
          Add a person
        </button>
        {done && <p style={{ color: "var(--ok)", fontSize: "0.9375rem" }}>{done}</p>}
      </div>
    );
  }

  return (
    <form
      ref={form}
      className={styles.form}
      action={(fd) =>
        start(async () => {
          setError(null);
          const res = await createPerson(fd);
          if (res.error) return setError(res.error);
          setDone(`Created ${res.email}. They sign in with the default password.`);
          form.current?.reset();
          setOpen(false);
          router.refresh();
        })
      }
    >
      <label>
        Role
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="faculty">Faculty</option>
          <option value="admin">HOD / DOE</option>
        </select>
      </label>
      <label>
        Full name
        <input name="full_name" required placeholder="Aarav Sharma" />
      </label>
      <label>
        Email
        <input name="email" type="email" required placeholder="1ep23cs001@eastpoint.ac.in" />
      </label>
      {role === "student" && (
        <>
          <label>
            USN
            <input name="usn" required placeholder="1EP23CS001" style={{ textTransform: "uppercase" }} />
          </label>
          <label>
            Department
            <input name="dept" defaultValue="CSE" />
          </label>
          <label>
            Semester
            <input name="semester" type="number" min="1" max="8" defaultValue={5} />
          </label>
        </>
      )}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </button>
        <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
