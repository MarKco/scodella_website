// Lo stato derivato che l'interfaccia legge: menu scelto + dati statici + feed + lingua → contenuto di ogni giorno.
import { addDays, isWeekend, type ISODate } from './dates';
import { badges, composeDay, DisplayNames, hasFood, type DayContent, type Food } from './content';
import { closureOn, effectiveMoves, effectiveVariations, moveSources, pickText, remoteClosures } from './feed';
import { currentMenu, effectiveMenus, lastDay, resolveDay } from './menus';
import { computeStreak, type StreakInfo } from './streak';
import type { Closure, DishInfo, Feed, LangPack, Menu, RemoteClosure, SeasonRecipes } from './types';

export interface StaticData {
  menus: Menu[];
  dishes: Record<string, DishInfo>;
  closures: Closure[];
  recipes: Record<string, SeasonRecipes>;
}

export interface ClosedDay {
  title: string | null;
  reason: string;
  from: ISODate;
  to: ISODate;
}

export class Model {
  readonly menus: Menu[];
  readonly menu: Menu | null;
  readonly names: DisplayNames;
  private readonly remote: RemoteClosure[];
  private readonly cache = new Map<ISODate, DayContent | null>();

  constructor(
    readonly data: StaticData,
    readonly feed: Feed,
    pack: LangPack,
    readonly language: string,
    selectedMenuId: string | null,
    readonly today: ISODate,
  ) {
    this.menus = effectiveMenus(data.menus, feed.config);
    this.menu = currentMenu(this.menus, selectedMenuId, today);
    this.names = new DisplayNames(pack, language);
    this.remote = remoteClosures(feed);
  }

  /** Giorno senza mensa: chiusura del calendario o comunicata dal comune. `null` se c'è mensa. */
  closure(date: ISODate): ClosedDay | null {
    const r = closureOn(this.remote, date);
    if (r) return { title: null, reason: pickText(r.names, this.language) ?? '', from: r.from, to: r.to };
    const s = this.data.closures.find((c) => date >= c.from && date <= c.to);
    if (s) return { title: null, reason: this.names.closure(s.label), from: s.from, to: s.to };
    return null;
  }

  /** Il giorno compare tra quelli navigabili: lun–ven e senza chiusura. */
  isVisible(date: ISODate): boolean {
    return !isWeekend(date) && this.closure(date) === null;
  }

  /** Il primo giorno visibile dopo (dir=1) o prima (dir=-1) di `date`. */
  step(date: ISODate, dir: 1 | -1): ISODate {
    let d = addDays(date, dir);
    for (let i = 0; i < 4000 && !this.isVisible(d); i++) d = addDays(d, dir);
    return d;
  }

  /** `date` se è visibile, altrimenti il successivo visibile. */
  onOrAfter(date: ISODate): ISODate {
    return this.isVisible(date) ? date : this.step(date, 1);
  }

  content(date: ISODate): DayContent | null {
    if (this.cache.has(date)) return this.cache.get(date)!;
    const result = this.compute(date);
    this.cache.set(date, result);
    return result;
  }

  private compute(date: ISODate): DayContent | null {
    const menu = this.menu;
    if (!menu || this.closure(date)) return null;
    const moves = effectiveMoves(this.feed, menu.season);
    const day = resolveDay(menu, date, moveSources(moves));
    if (!day) return null;
    const applied = new Set([...moves.values()].map((m) => m.id));
    const variations = effectiveVariations(this.feed, menu.id, applied).get(date) ?? new Map();
    return composeDay(day, variations, moves.get(date) ?? null, this.data.dishes, this.names);
  }

  badgesOf(date: ISODate) {
    const c = this.content(date);
    return c ? badges(c.entries) : [];
  }

  streak(date: ISODate, food: Food): StreakInfo | null {
    const menu = this.menu;
    if (!menu || !this.content(date)) return null;
    return computeStreak(date, menu.validFrom, lastDay(menu), (d) => {
      const c = this.content(d);
      return !!c && hasFood(c, food);
    });
  }

  recipes(): SeasonRecipes | undefined {
    return this.menu ? this.data.recipes[this.menu.season] : undefined;
  }
}
