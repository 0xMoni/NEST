"use client";

import styles from "@/app/student/attendance/attendance.module.css";

/** Her mockups exported a light-mode PDF with jsPDF. The browser already makes
 *  PDFs, and a print stylesheet forces light regardless of the viewer's theme —
 *  so this is the same outcome without a 300KB dependency, and it keeps real
 *  selectable text rather than a canvas screenshot. */
export function PrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <button type="button" className={styles.printBtn} onClick={() => window.print()} data-print-hide>
      {label}
    </button>
  );
}
