import { WEEKDAYS, type OpeningHours, type Weekday } from './constants';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidHours(hours: unknown): hours is OpeningHours {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return false;
  for (const [day, ranges] of Object.entries(hours as Record<string, unknown>)) {
    if (!(WEEKDAYS as readonly string[]).includes(day) || !Array.isArray(ranges) || ranges.length > 4) return false;
    for (const r of ranges) {
      if (!Array.isArray(r) || r.length !== 2 || !TIME.test(r[0]) || !TIME.test(r[1]) || r[0] === r[1]) return false;
    }
  }
  return true;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Weekday and minutes-since-midnight of `at` in the place's own time zone. */
function localTime(at: Date, timeZone: string): { day: Weekday; mins: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = get('weekday').slice(0, 3).toLowerCase() as Weekday;
  return { day, mins: Number(get('hour')) * 60 + Number(get('minute')) };
}

/**
 * Open right now? `null` when we simply don't know the hours (lots of street stalls),
 * so the app can say "hours unknown" instead of wrongly claiming it's closed.
 */
export function isOpenAt(hours: OpeningHours | null | undefined, at: Date, timeZone = 'Asia/Ho_Chi_Minh'): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const { day, mins } = localTime(at, timeZone);
  const today = WEEKDAYS.indexOf(day);
  const yesterday = WEEKDAYS[(today + 6) % 7];
  for (const [o, c] of hours[day] ?? []) {
    const open = minutes(o);
    const close = minutes(c);
    if (close > open ? mins >= open && mins < close : mins >= open) return true;
  }
  // Last night's late shift spilling past midnight.
  for (const [o, c] of hours[yesterday] ?? []) {
    if (minutes(c) < minutes(o) && mins < minutes(c)) return true;
  }
  return false;
}
