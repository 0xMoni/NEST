"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Me } from "@/lib/session";
import styles from "./shell.module.css";

type NavLink = { href: string; label: string };
type NavDropdown = { label: string; children: NavLink[] };
type NavItem = NavLink | NavDropdown;

const NAV: Record<Me["role"], NavItem[]> = {
  student: [
    { href: "/student", label: "Dashboard" },
    { href: "/student/attendance", label: "Attendance" },
    { href: "/student/scorecard", label: "Scorecard" },
    { href: "/student/timetable", label: "Timetable" },
    {
      label: "AI Zone",
      children: [
        { href: "/student/roadmap", label: "AI Roadmap" },
        { href: "/student/quiz", label: "AI Quiz" },
      ],
    },
    { href: "/student/profile", label: "Profile" },
  ],
  faculty: [
    { href: "/faculty", label: "Today" },
    { href: "/faculty/attendance", label: "Mark attendance" },
    { href: "/faculty/marks", label: "Marks" },
    { href: "/faculty/mentees", label: "Mentees" },
    { href: "/profile", label: "Profile" },
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
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <div className={styles.brandBlock}>
          <Image
            className={styles.brand}
            src="/nest-logo.png"
            alt="NEST"
            width={274}
            height={246}
            priority
          />
          <p className={styles.roleTag}>{ROLE_LABEL[me.role]}</p>
        </div>

        <nav className={styles.nav}>
          {NAV[me.role].map((item) => {
            if ("children" in item) {
              return (
                <NavGroupItem
                  key={item.label}
                  item={item}
                  currentPath={pathname}
                />
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            );
          })}
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
        {title && <h1 className={styles.title}>{title}</h1>}
        {sub && <p className={styles.sub}>{sub}</p>}
        {children}
      </main>
    </div>
  );
}

function NavGroupItem({
  item,
  currentPath,
}: {
  item: NavDropdown;
  currentPath: string;
}) {
  const isAnyChildActive = item.children.some((child) =>
    currentPath.startsWith(child.href)
  );
const [isOpen, setIsOpen] = useState<boolean>(isAnyChildActive);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          padding: "8px 12px",
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          fontWeight: isAnyChildActive ? 600 : 500,
        }}
      >
        <span>{item.label}</span>
        <span
          style={{
            fontSize: "10px",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            paddingLeft: "16px",
            borderLeft: "2px solid rgba(0, 0, 0, 0.08)",
            marginLeft: "12px",
            gap: "2px",
            marginTop: "2px",
            marginBottom: "4px",
          }}
        >
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              style={{
                fontSize: "0.875rem",
                opacity: currentPath === child.href ? 1 : 0.75,
                fontWeight: currentPath === child.href ? 600 : 400,
              }}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}