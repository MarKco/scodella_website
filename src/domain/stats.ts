// Statistiche sulle variazioni comunicate dalla mensa nel periodo (versione web di SubstitutionStats: niente costi né variazioni dell'utente).
import { addDays, isoWeekday, type ISODate } from './dates';
import type { Category } from './types';
import { CATEGORIES } from './types';
import type { Model } from './model';
import { effectiveMoves, effectiveVariations } from './feed';

export interface Counted {
  label: string;
  count: number;
}

export interface Stats {
  from: ISODate;
  to: ISODate;
  mensaDays: number;
  replaced: number;
  deleted: number;
  daysWithChanges: number;
  dishPairs: Counted[];
  mostReplaced: Counted[];
  mostChosen: Counted[];
  byCategory: Partial<Record<Category, number>>;
  byWeekday: number[]; // lun–ven
}

const top = (map: Map<string, number>, limit: number): Counted[] =>
  [...map]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export function computeStats(model: Model, from: ISODate, to: ISODate): Stats {
  const menu = model.menu;
  const stats: Stats = {
    from, to, mensaDays: 0, replaced: 0, deleted: 0, daysWithChanges: 0,
    dishPairs: [], mostReplaced: [], mostChosen: [], byCategory: {}, byWeekday: [0, 0, 0, 0, 0],
  };
  if (!menu) return stats;
  const moves = effectiveMoves(model.feed, menu.season);
  const applied = new Set([...moves.values()].map((m) => m.id));
  const byDate = effectiveVariations(model.feed, menu.id, applied);
  const pairs = new Map<string, number>();
  const replacedMap = new Map<string, number>();
  const chosenMap = new Map<string, number>();
  const cat = new Map<Category, number>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const content = model.content(d);
    if (!content) continue;
    stats.mensaDays++;
    // Si contano solo le variazioni che si agganciano davvero a un piatto del giorno.
    const changed = content.entries.filter((e) => e.replaced || e.deleted);
    if (changed.length === 0 || !byDate.has(d)) continue;
    stats.daysWithChanges++;
    for (const e of changed) {
      if (e.deleted) {
        stats.deleted++;
        continue;
      }
      stats.replaced++;
      bump(pairs, `${e.original} → ${e.text}`);
      bump(replacedMap, e.original);
      bump(chosenMap, e.text);
      cat.set(e.category, (cat.get(e.category) ?? 0) + 1);
      stats.byWeekday[isoWeekday(d) - 1]++;
    }
  }
  stats.dishPairs = top(pairs, 10);
  stats.mostReplaced = top(replacedMap, 5);
  stats.mostChosen = top(chosenMap, 5);
  for (const c of CATEGORIES) if (cat.get(c)) stats.byCategory[c] = cat.get(c);
  return stats;
}
