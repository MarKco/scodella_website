// Date come stringhe ISO `AAAA-MM-GG` (giorni di calendario, senza fuso): tutto il calcolo passa da UTC.

export type ISODate = string;

const DAY_MS = 86_400_000;

export function parseISO(s: ISODate): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return toISO(d) === s ? d : null;
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Oggi nel fuso locale dell'utente. */
export function todayISO(now = new Date()): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  if (!d) throw new Error(`data non valida: ${s}`);
  return toISO(new Date(d.getTime() + n * DAY_MS));
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((parseISO(to)!.getTime() - parseISO(from)!.getTime()) / DAY_MS);
}

/** 1 = lunedì … 7 = domenica. */
export function isoWeekday(s: ISODate): number {
  const d = parseISO(s)!.getUTCDay();
  return d === 0 ? 7 : d;
}

export function isWeekend(s: ISODate): boolean {
  return isoWeekday(s) >= 6;
}

export function mondayOf(s: ISODate): ISODate {
  return addDays(s, -(isoWeekday(s) - 1));
}

export function weeksBetween(a: ISODate, b: ISODate): number {
  return Math.floor(diffDays(a, b) / 7);
}

export function cmp(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function inRange(d: ISODate, from: ISODate, to: ISODate): boolean {
  return d >= from && d <= to;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}
