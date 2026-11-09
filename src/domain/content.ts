// Port di DisplayNames / DishCatalog / DayContents (app Android, `DisplayNames.kt`, `DayContent.kt`). Solo variazioni della mensa:
// sul sito non esistono variazioni dell'utente.
import type { ISODate } from './dates';
import { pickText } from './feed';
import { dishKey, type DayMenu } from './menus';
import type { Category, DishInfo, DishKind, LangPack, Menu, RemoteMove, RemoteVariation } from './types';

export class DisplayNames {
  constructor(
    readonly pack: LangPack,
    readonly language: string,
  ) {}

  dish(key: string, fallback: string): string {
    return this.pack.dishes[key] ?? fallback;
  }
  menu(m: Menu): string {
    return this.pack.menus[m.id]?.name ?? m.name;
  }
  dietLabel(m: Menu): string | null {
    return m.dietLabel ? (this.pack.menus[m.id]?.dietLabel ?? m.dietLabel) : null;
  }
  dietNote(m: Menu): string | null {
    return m.dietNote ? (this.pack.menus[m.id]?.dietNote ?? m.dietNote) : null;
  }
  /** Nome breve: la dieta, se è una dieta, altrimenti il menu. */
  menuTitle(m: Menu): string {
    return this.dietLabel(m) ?? this.menu(m);
  }
  closure(label: string): string {
    return this.pack.closures[label] ?? label;
  }
  note(text: string): string {
    return this.pack.notes[text] ?? text;
  }
  term(text: string): string {
    return this.pack.terms[text] ?? text;
  }
  ingredient(season: string, id: string, field: 'name' | 'composition', fallback: string | undefined): string | undefined {
    return this.pack.ingredients[`${season}/${id}`]?.[field] ?? fallback;
  }
}

export interface DishEntry {
  originalKey: string;
  original: string;
  note: string | null;
  text: string;
  category: Category;
  kind: DishKind | null;
  replaced: boolean;
  deleted: boolean;
  eggs: boolean;
  /** `id@updatedAt` della variazione della mensa, se c'è. */
  canteenVersion: string | null;
  canteenAt: number | null;
  /** Chiave del catalogo del piatto servito, per cercarne la ricetta. */
  recipeKey: string | null;
  /** Posizione del piatto nel giorno del menu (prima dell'ordinamento per portata): è uguale in tutti i menu della stessa stagione. */
  slot: number;
  /** Portata del piatto del menu (non di quello che lo sostituisce): serve ad allinearlo tra menu diversi. */
  baseCategory: Category;
}

export interface MovedDay {
  from: ISODate;
  note: string | null;
}

export interface DayContent {
  day: DayMenu;
  date: ISODate;
  entries: DishEntry[];
  moved: MovedDay | null;
}

const ORDER: Category[] = ['PRIMO', 'SECONDO', 'CONTORNO', 'PANE', 'FRUTTA', 'DESSERT'];

export function composeDay(
  day: DayMenu,
  variations: Map<string, RemoteVariation>,
  move: RemoteMove | null,
  catalog: Record<string, DishInfo>,
  names: DisplayNames,
): DayContent {
  const entries = day.dishes.map((dish, slot): DishEntry => {
    const key = dishKey(dish.name);
    const info = catalog[key];
    const variation = variations.get(key);
    const category = info?.category ?? 'SECONDO';
    const original = names.dish(key, dish.name);
    const note = dish.note ? names.note(dish.note) : null;
    const base = {
      slot,
      baseCategory: category,
      originalKey: key,
      original,
      note,
      canteenVersion: variation ? `${variation.id}@${variation.updatedAt}` : null,
      canteenAt: variation?.updatedAt ?? null,
    };
    if (variation?.kind === 'REPLACE') {
      const catalogKey = variation.catalogKey ?? null;
      const chosen = catalogKey ? catalog[catalogKey] : undefined;
      // Piatto noto: la traduzione è quella del catalogo; fuori catalogo, i nomi per lingua della variazione.
      const text = chosen && catalogKey ? names.dish(catalogKey, chosen.name) : (pickText(variation.names, names.language) ?? original);
      return {
        ...base,
        text,
        category: chosen?.category ?? category,
        kind: chosen?.kind ?? null,
        replaced: true,
        deleted: false,
        eggs: chosen?.eggs ?? false,
        recipeKey: chosen ? catalogKey : null,
      };
    }
    if (variation?.kind === 'DELETE') {
      return { ...base, text: original, category, kind: info?.kind ?? null, replaced: false, deleted: true, eggs: info?.eggs ?? false, recipeKey: null };
    }
    return { ...base, text: original, category, kind: info?.kind ?? null, replaced: false, deleted: false, eggs: info?.eggs ?? false, recipeKey: key };
  });
  // Ordinamento stabile: l'ordine del PDF si mantiene dentro ogni portata.
  entries.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
  return {
    day,
    date: day.date,
    entries,
    moved: day.movedFrom && move ? { from: day.movedFrom, note: pickText(move.note, names.language) } : null,
  };
}

/** Carne / pesce / affettati se presenti; altrimenti vegetariana (o vegana se ogni piatto noto lo è). */
export function badges(entries: DishEntry[]): DishKind[] {
  const kinds = entries.filter((e) => !e.deleted && e.kind).map((e) => e.kind!);
  if (kinds.length === 0) return [];
  const animal = (['MEAT', 'FISH', 'COLD_CUTS'] as DishKind[]).filter((k) => kinds.includes(k));
  if (animal.length) return animal;
  return [kinds.every((k) => k === 'VEGAN') ? 'VEGAN' : 'VEGETARIAN'];
}

export type Food = 'EGGS' | 'MEAT' | 'FISH';
export const FOODS: Food[] = ['EGGS', 'MEAT', 'FISH'];

export function foodMatches(food: Food, e: DishEntry): boolean {
  if (food === 'EGGS') return e.eggs;
  if (food === 'MEAT') return e.kind === 'MEAT' || e.kind === 'COLD_CUTS';
  return e.kind === 'FISH';
}

export function hasFood(content: DayContent, food: Food): boolean {
  return content.entries.some((e) => !e.deleted && foodMatches(food, e));
}
