import styles from "./ui.module.css";

export const ui = styles;

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export function Tile({ label, value, foot }: { label: string; value: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.big}>{value}</strong>
      {foot && <span className={styles.foot}>{foot}</span>}
    </div>
  );
}

export function Badge({ tone = "muted", children }: { tone?: "ok" | "bad" | "muted"; children: React.ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

/** A percentage as a bar. Reading a number is slower than seeing a length. */
export function Bar({ value, short }: { value: number | null; short?: boolean }) {
  return (
    <span className={styles.bar} aria-hidden="true">
      <span className={styles.barFill} data-short={String(Boolean(short))} style={{ width: `${Math.min(100, value ?? 0)}%` }} />
    </span>
  );
}
