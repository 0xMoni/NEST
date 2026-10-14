/** Period times.
 *
 *  Placeholders until the college confirms theirs — the shape is the usual
 *  six-period day with a mid-morning break and lunch. Everything that shows a
 *  time reads from here, so correcting them is one edit.
 */
export const PERIODS = [
  { n: 1, from: "09:00", to: "09:55" },
  { n: 2, from: "09:55", to: "10:50" },
  { n: 3, from: "11:10", to: "12:05" },
  { n: 4, from: "12:05", to: "13:00" },
  { n: 5, from: "13:45", to: "14:40" },
  { n: 6, from: "14:40", to: "15:35" },
] as const;

export const BREAK_AFTER = { 2: "Break", 4: "Lunch" } as const;

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** Which period is running, and which is next, for a given time. */
export function periodAt(now: Date) {
  const m = now.getHours() * 60 + now.getMinutes();
  const current = PERIODS.find((p) => m >= mins(p.from) && m < mins(p.to))?.n ?? null;
  const next = PERIODS.find((p) => mins(p.from) > m)?.n ?? null;
  return { current, next };
}
