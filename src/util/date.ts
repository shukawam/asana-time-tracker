export type IsoDate = string;

export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid date (expected YYYY-MM-DD): ${s}`);
  }
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (toIsoDate(date) !== s) {
    throw new Error(`Invalid date (does not exist on the calendar): ${s}`);
  }
  return date;
}

/**
 * Monday-based week range containing the given date.
 * Returns inclusive [start, end] in ISO date form.
 */
export function weekRange(date: Date = new Date()): { start: IsoDate; end: IsoDate; days: IsoDate[] } {
  const ref = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = ref.getDay();
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - daysSinceMonday);
  const days: IsoDate[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toIsoDate(d));
  }
  return { start: days[0], end: days[6], days };
}

export function lastWeekRange(date: Date = new Date()): { start: IsoDate; end: IsoDate; days: IsoDate[] } {
  const ref = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  ref.setDate(ref.getDate() - 7);
  return weekRange(ref);
}

/**
 * Sunday-based week range containing the given date — Sun→Sat.
 * Used by the SFDC format to match the Time Entry grid's column order.
 */
export function sundayWeekRange(date: Date = new Date()): { start: IsoDate; end: IsoDate; days: IsoDate[] } {
  const ref = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceSunday = ref.getDay();
  const sunday = new Date(ref);
  sunday.setDate(ref.getDate() - daysSinceSunday);
  const days: IsoDate[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push(toIsoDate(d));
  }
  return { start: days[0], end: days[6], days };
}

export function lastSundayWeekRange(date: Date = new Date()): { start: IsoDate; end: IsoDate; days: IsoDate[] } {
  const ref = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  ref.setDate(ref.getDate() - 7);
  return sundayWeekRange(ref);
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function dowLabel(iso: IsoDate): string {
  const d = parseIsoDate(iso);
  const dow = (d.getDay() + 6) % 7;
  return DOW_LABELS[dow];
}
