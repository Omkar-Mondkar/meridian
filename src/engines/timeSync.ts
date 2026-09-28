/**
 * timeSync.ts — Pure IST/TZ time utilities.
 * Uses Intl.DateTimeFormat exclusively — never relies on the OS timezone.
 * All functions are pure (no side-effects) so they're easy to test.
 */

export interface TimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string; // 'Mon' | 'Tue' | ... 'Sat' | 'Sun'
}

const IST_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour12: false,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Extract time parts in Asia/Kolkata (IST) from the current moment. */
export function getISTParts(date: Date = new Date()): TimeParts {
  const parts: Record<string, string> = {};
  IST_FMT.formatToParts(date).forEach((x) => { parts[x.type] = x.value; });
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
    second: +parts.second,
    weekday: parts.weekday,
  };
}

/** Extract time parts in any IANA timezone. */
export function getTZParts(tz: string, date: Date = new Date()): TimeParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  fmt.formatToParts(date).forEach((x) => { parts[x.type] = x.value; });
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
    second: +parts.second,
    weekday: parts.weekday,
  };
}

/** Convert "HH:MM" string to total minutes from midnight. */
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Format total minutes as "HH:MM" string. */
export function fmtHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Zero-pad a number to 2 digits. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
