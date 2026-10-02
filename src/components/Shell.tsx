import Image from "next/image";
import Link from "next/link";
import type { Me } from "@/lib/session";
import styles from "./shell.module.css";

const NAV: Record<Me["role"], { href: string; label: string }[]> = {
  student: [
    { href: "/student", label: "Dashboard" },
    { href: "/student/attendance", label: "Attendance" },
    { href: "/student/scorecard", label: "Scorecard" },
    { href: "/student/timetable", label: "Timetable" },
  ],
  faculty: [
    { href: "/faculty", label: "Today" },
    { href: "/faculty/attendance", label: "Mark attendance" },
    { href: "/faculty/marks", label: "Marks" },
    { href: "/faculty/mentees", label: "Mentees" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/people", label: "People" },
    { href: "/admin/structure", label: "Sections & subjects" },
    { href: "/admin/timetable", label: "Timetable" },
  ],
};

const ROLE_LABEL: Record<Me["role"], string> = {
  student: "Student",
  faculty: "Faculty",
  admin: "HOD / DOE",
};

export function Shell({
  me,
  title,
  sub,
  wide,
  children,
}: {
  me: Me;
  title: string;
  sub?: string;
  /** Drop the reading-width cap. For grids that earn the whole screen. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <div className={styles.brandBlock}>
          <Image className={styles.brand} src="/nest-logo.png" alt="NEST" width={274} height={246} priority />
          <p className={styles.roleTag}>{ROLE_LABEL[me.role]}</p>
        </div>

        <nav className={styles.nav}>
          {NAV[me.role].map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.who}>
          <b>{me.full_name}</b>
          <span>{me.usn ?? me.email}</span>
          <form action="/auth/signout" method="post">
            <button className={styles.signout} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className={`${styles.main} ${wide ? styles.wide : ""}`}>
        <h1 className={styles.title}>{title}</h1>
        {sub && <p className={styles.sub}>{sub}</p>}
        {children}
      </main>
    </div>
  );
}
