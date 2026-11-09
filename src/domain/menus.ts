// Port di MenuFiles / MenuResolver / MenuChoices / RemoteConfigs.effectiveMenus (app Android, modulo `domain`).
import { addDays, cmp, isoWeekday, isWeekend, mondayOf, parseISO, weeksBetween, type ISODate } from './dates';
import type { Menu, MenuDish, MenuFile, RemoteConfig } from './types';

export function dishKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}+/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function full(f: MenuFile): Menu {
  if (!f.accent || !f.validFrom || !f.weeks) throw new Error(`${f.id}: menu base incompleto`);
  if (!parseISO(f.validFrom)) throw new Error(`${f.id}: validFrom illeggibile`);
  if (f.validTo && (!parseISO(f.validTo) || f.validTo < f.validFrom)) throw new Error(`${f.id}: validTo non valido`);
  return {
    id: f.id,
    name: f.name,
    accent: f.accent,
    validFrom: f.validFrom,
    validTo: f.validTo ?? null,
    weeks: f.weeks,
    season: f.season ?? f.id,
    diet: f.diet ?? null,
    dietLabel: f.dietLabel ?? null,
    dietNote: f.dietNote ?? null,
    order: f.order ?? null,
    restrictions: f.restrictions ?? [],
  };
}

function expand(base: Menu, f: MenuFile): Menu {
  const weeks: Record<string, MenuDish[][]> = {};
  for (const [label, days] of Object.entries(base.weeks)) weeks[label] = days.map((d) => d.slice());
  for (const c of f.changes ?? []) {
    const day = weeks[c.week]?.[c.day - 1];
    if (!day) throw new Error(`${f.id}: settimana ${c.week} giorno ${c.day} non esiste`);
    if (c.slot < 1 || c.slot > day.length) throw new Error(`${f.id}: posizione ${c.slot} fuori dai ${day.length} piatti`);
    day[c.slot - 1] = c.dish;
  }
  return {
    id: f.id,
    name: f.name,
    accent: f.accent ?? base.accent,
    validFrom: f.validFrom ?? base.validFrom,
    validTo: f.validTo ?? base.validTo,
    weeks,
    season: f.season ?? base.id,
    diet: f.diet ?? null,
    dietLabel: f.dietLabel ?? null,
    dietNote: f.dietNote ?? null,
    order: f.order ?? null,
    restrictions: f.restrictions ?? [],
  };
}

/** Menu completi dai file: prima i base, poi le diete espanse. Un file rovinato si scarta (e si avvisa `onSkipped`). */
export function assembleMenus(files: MenuFile[], onSkipped: (id: string, e: unknown) => void = () => {}): Menu[] {
  const bases = new Map<string, Menu>();
  for (const f of files.filter((x) => x.weeks)) {
    try {
      bases.set(f.id, full(f));
    } catch (e) {
      onSkipped(f.id, e);
    }
  }
  const diets: Menu[] = [];
  for (const f of files.filter((x) => !x.weeks)) {
    try {
      const base = bases.get(f.season ?? '');
      if (!base) throw new Error(`${f.id}: nessun menu base '${f.season}'`);
      diets.push(expand(base, f));
    } catch (e) {
      onSkipped(f.id, e);
    }
  }
  return [...bases.values(), ...diets];
}

/** Ultimo giorno in cui il menu vale: `validTo`, altrimenti il 30 giugno dell'anno scolastico. */
export function lastDay(menu: Menu): ISODate {
  if (menu.validTo) return menu.validTo;
  const from = parseISO(menu.validFrom)!;
  const year = from.getUTCMonth() + 1 > 6 ? from.getUTCFullYear() + 1 : from.getUTCFullYear();
  return `${year}-06-30`;
}

/** Applica la fine di stagione pubblicata (`config.menuValidity`). */
export function effectiveMenus(menus: Menu[], config: RemoteConfig): Menu[] {
  const validity = config.menuValidity ?? {};
  return menus.map((m) => {
    const end = validity[m.season];
    if (!end || !parseISO(end) || end < m.validFrom) return m;
    return { ...m, validTo: end };
  });
}

export interface DayMenu {
  menu: Menu;
  date: ISODate;
  week: string;
  dishes: MenuDish[];
  movedFrom: ISODate | null;
}

function resolveOwn(menu: Menu, date: ISODate): DayMenu | null {
  if (isWeekend(date) || date < menu.validFrom || date > lastDay(menu)) return null;
  const labels = Object.keys(menu.weeks);
  if (labels.length === 0) return null;
  const weeks = weeksBetween(mondayOf(menu.validFrom), mondayOf(date));
  const label = labels[((weeks % labels.length) + labels.length) % labels.length];
  const dishes = menu.weeks[label][isoWeekday(date) - 1];
  if (!dishes) return null;
  return { menu, date, week: label, dishes, movedFrom: null };
}

/** `moves`: data → data del menu servito. */
export function resolveDay(menu: Menu, date: ISODate, moves: Map<ISODate, ISODate> = new Map()): DayMenu | null {
  const normal = resolveOwn(menu, date);
  if (!normal) return null;
  const source = moves.get(date);
  if (!source) return normal;
  const moved = resolveOwn(menu, source);
  if (!moved) return normal;
  return { menu, date, week: moved.week, dishes: moved.dishes, movedFrom: source };
}

// --- scelta del menu ----------------------------------------------------------------------------------------------

const endedBefore = (m: Menu, day: ISODate) => day > lastDay(m);
const validOn = (m: Menu, day: ISODate) => day >= m.validFrom && !endedBefore(m, day);

export function seasons(menus: Menu[]): Menu[] {
  return menus.filter((m) => m.diet === null);
}

export function inSeason(menus: Menu[], seasonId: string): Menu[] {
  return menus
    .filter((m) => m.season === seasonId)
    .sort(
      (a, b) =>
        Number(a.diet !== null) - Number(b.diet !== null) ||
        (a.order ?? 1e9) - (b.order ?? 1e9) ||
        (a.dietLabel ?? '').localeCompare(b.dietLabel ?? ''),
    );
}

export function startMenu(menus: Menu[], today: ISODate): Menu | null {
  let bases = menus.filter((m) => m.diet === null);
  if (bases.length === 0) bases = menus;
  return (
    bases.find((m) => validOn(m, today)) ?? bases.find((m) => cmp(m.validFrom, today) > 0) ?? bases[bases.length - 1] ?? null
  );
}

export function switchSeason(menus: Menu[], current: Menu | null, seasonId: string): Menu | null {
  const list = inSeason(menus, seasonId);
  const diet = current?.diet ?? null;
  return list.find((m) => diet !== null && m.diet === diet) ?? list.find((m) => m.diet === null) ?? null;
}

/** Il menu da usare oggi: se la stagione scelta è finita e ne è iniziata un'altra, si passa alla nuova tenendo la dieta. */
export function currentMenu(menus: Menu[], selectedId: string | null, today: ISODate): Menu | null {
  const selected = menus.find((m) => m.id === selectedId);
  if (!selected) return startMenu(menus, today);
  if (!endedBefore(selected, today)) return selected;
  const now = startMenu(menus, today);
  if (!now || !validOn(now, today) || now.season === selected.season) return selected;
  return switchSeason(menus, selected, now.season) ?? selected;
}

export function selectableSeasons(menus: Menu[], today: ISODate): Menu[] {
  const open = seasons(menus).filter((m) => !endedBefore(m, today));
  return open.length ? open : seasons(menus);
}

export { addDays };
