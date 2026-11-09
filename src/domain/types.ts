import type { ISODate } from './dates';

export type Category = 'PRIMO' | 'SECONDO' | 'CONTORNO' | 'PANE' | 'FRUTTA' | 'DESSERT';
export const CATEGORIES: Category[] = ['PRIMO', 'SECONDO', 'CONTORNO', 'PANE', 'FRUTTA', 'DESSERT'];
export type DishKind = 'VEGAN' | 'VEGETARIAN' | 'MEAT' | 'FISH' | 'COLD_CUTS';

export interface MenuDish {
  name: string;
  note?: string;
}

export interface MenuChange {
  week: string;
  day: number;
  slot: number;
  dish: MenuDish;
}

/** Un file di `data/menus.json`: un base ha `weeks`, una dieta ha solo `changes`. */
export interface MenuFile {
  id: string;
  name: string;
  accent?: string;
  validFrom?: ISODate;
  validTo?: ISODate | null;
  weeks?: Record<string, MenuDish[][]>;
  season?: string;
  diet?: string;
  dietLabel?: string;
  dietNote?: string;
  order?: number;
  restrictions?: string[];
  changes?: MenuChange[];
}

export interface Menu {
  id: string;
  name: string;
  accent: string;
  validFrom: ISODate;
  validTo: ISODate | null;
  weeks: Record<string, MenuDish[][]>;
  season: string;
  diet: string | null;
  dietLabel: string | null;
  dietNote: string | null;
  order: number | null;
  restrictions: string[];
}

export interface DishInfo {
  name: string;
  category: Category;
  kind: DishKind;
  eggs?: boolean;
}

export interface Closure {
  from: ISODate;
  to: ISODate;
  label: string;
}

// --- feed (public/data/feed.json, generato da scripts/fetch-feed.mjs da Firestore `feed/current`) ---------------------

export type Texts = Record<string, string>;

export interface RemoteVariation {
  id: string;
  menuId: string;
  date: ISODate;
  originalKey: string;
  kind: 'REPLACE' | 'DELETE';
  catalogKey?: string | null;
  names?: Texts;
  active: boolean;
  updatedAt: number;
  move?: string | null;
}

export interface RemoteMove {
  id: string;
  season: string;
  date: ISODate;
  fromDate: ISODate;
  note?: Texts;
  active: boolean;
  updatedAt: number;
}

export interface RemoteMessage {
  id: string;
  title?: Texts;
  body?: Texts;
  from?: number | null;
  to?: number | null;
  active: boolean;
  updatedAt: number;
}

export interface RemoteClosure {
  id: string;
  from: ISODate;
  to: ISODate;
  names?: Texts;
  active: boolean;
  updatedAt: number;
}

export interface RemoteConfig {
  closures?: RemoteClosure[];
  menuValidity?: Record<string, ISODate>;
  features?: { moves?: boolean; notifications?: boolean; closures?: boolean };
}

export interface Feed {
  version: number;
  updatedAt: number;
  variations: RemoteVariation[];
  moves: RemoteMove[];
  messages: RemoteMessage[];
  config: RemoteConfig;
}

export const EMPTY_FEED: Feed = { version: 0, updatedAt: 0, variations: [], moves: [], messages: [], config: {} };

// --- ricette (public/data/recipes.json) ---------------------------------------------------------------------------

export interface Recipe {
  name: string;
  ingredients: string[];
  allergens: string[];
  traces: string[];
  flags: string[];
  tags: string[];
  url: string | null;
}

export interface Ingredient {
  name: string;
  composition?: string;
  organic?: boolean;
  frozen?: boolean;
}

export interface SeasonRecipes {
  links: Record<string, string>;
  recipes: Record<string, Recipe>;
  ingredients: Record<string, Ingredient>;
}

// --- traduzioni (public/data/lang/<lingua>.json) -------------------------------------------------------------------

export type UiString = string | Record<string, string>;

export interface LangPack {
  ui: Record<string, UiString>;
  dishes: Record<string, string>;
  menus: Record<string, { name?: string; dietLabel?: string; dietNote?: string }>;
  closures: Record<string, string>;
  notes: Record<string, string>;
  ingredients: Record<string, { name?: string; composition?: string }>;
  terms: Record<string, string>;
}

export const EMPTY_PACK: LangPack = { ui: {}, dishes: {}, menus: {}, closures: {}, notes: {}, ingredients: {}, terms: {} };
