// Port di FoodStreak: giorni dall'ultima e al prossima volta di un alimento.
import { addDays, diffDays, type ISODate } from './dates';

export interface StreakInfo {
  today: boolean;
  daysSinceLast: number | null;
  daysUntilNext: number | null;
}

export const MAX_SCAN_DAYS = 120;

export function computeStreak(date: ISODate, earliest: ISODate, latest: ISODate | null, on: (d: ISODate) => boolean): StreakInfo {
  let since: number | null = null;
  const stopBack = earliest > addDays(date, -MAX_SCAN_DAYS) ? earliest : addDays(date, -MAX_SCAN_DAYS);
  for (let d = addDays(date, -1); d >= stopBack; d = addDays(d, -1)) {
    if (on(d)) {
      since = diffDays(d, date);
      break;
    }
  }
  let until: number | null = null;
  const cap = addDays(date, MAX_SCAN_DAYS);
  const stopForward = latest && latest < cap ? latest : cap;
  for (let d = addDays(date, 1); d <= stopForward; d = addDays(d, 1)) {
    if (on(d)) {
      until = diffDays(date, d);
      break;
    }
  }
  return { today: on(date), daysSinceLast: since, daysUntilNext: until };
}
