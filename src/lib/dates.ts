// All dates are shown in the sangha's local time, whatever machine builds the site.
const TZ = 'America/New_York';
const f = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts });

export const weekday = (d: Date) => f({ weekday: 'long' }).format(d);
export const weekdayShort = (d: Date) => f({ weekday: 'short' }).format(d);
export const monthShort = (d: Date) => f({ month: 'short' }).format(d);
export const dayNum = (d: Date) => f({ day: 'numeric' }).format(d);
export const monthYear = (d: Date) => f({ month: 'long', year: 'numeric' }).format(d);
export const longDate = (d: Date) => f({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(d);
export const shortDate = (d: Date) => f({ month: 'short', day: 'numeric' }).format(d);
export const dayKey = (d: Date) => f({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const time = (d: Date) => f({ hour: 'numeric', minute: '2-digit' }).format(d).replace(':00', '');

export function timeRange(start: Date, end: Date | null, hasTime: boolean) {
  if (!hasTime) return '';
  if (!end || dayKey(start) !== dayKey(end)) return time(start);
  return `${time(start)} – ${time(end)}`;
}

/** "Friday, November 20 – Sunday, November 22, 2026" for multi-day events. */
export function dateRange(start: Date, end: Date | null) {
  if (!end || dayKey(start) === dayKey(end)) return longDate(start);
  const a = f({ weekday: 'long', month: 'long', day: 'numeric' }).format(start);
  return `${a} – ${longDate(end)}`;
}
