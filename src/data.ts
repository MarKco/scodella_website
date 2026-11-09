import { assembleMenus } from './domain/menus';
import { EMPTY_FEED, EMPTY_PACK, type Feed, type LangPack, type MenuFile, type SeasonRecipes } from './domain/types';
import type { StaticData } from './domain/model';

const url = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url(path), init);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadStatic(): Promise<StaticData> {
  const [files, dishes, closures, recipes] = await Promise.all([
    json<MenuFile[]>('menus.json'),
    json<{ dishes: StaticData['dishes'] }>('dishes.json'),
    json<StaticData['closures']>('closures.json'),
    json<Record<string, SeasonRecipes>>('recipes.json'),
  ]);
  const menus = assembleMenus(files, (id, e) => console.warn(`menu scartato: ${id}`, e));
  return { menus, dishes: dishes.dishes, closures, recipes };
}

/** Lingue per cui `extra/<lingua>.json` ha i testi propri del sito (it/en stanno in i18n.ts). */
const EXTRA_LANGS = ['hi', 'bn', 'te', 'ta', 'mr'];

export async function loadPack(lang: string): Promise<LangPack> {
  try {
    const [pack, extra] = await Promise.all([
      json<LangPack>(`lang/${lang}.json`),
      EXTRA_LANGS.includes(lang)
        ? json<Record<string, string>>(`extra/${lang}.json`).catch((e) => {
            console.warn(`testi del sito in ${lang} non disponibili`, e);
            return {};
          })
        : Promise.resolve({}),
    ]);
    // I testi dell'app (lang/) vincono su quelli del sito (extra/): non hanno chiavi in comune.
    return { ...EMPTY_PACK, ...pack, ui: { ...extra, ...pack.ui } };
  } catch (e) {
    console.warn(`lingua ${lang} non disponibile`, e);
    return EMPTY_PACK;
  }
}

function validFeed(x: unknown): x is Feed {
  const f = x as Feed;
  return !!f && typeof f === 'object' && Array.isArray(f.variations) && Array.isArray(f.moves) && Array.isArray(f.messages);
}

/** Il feed pubblicato dall'Action. Se manca o è rovinato, il sito funziona lo stesso col menu base. */
export async function loadFeed(fresh = false): Promise<{ feed: Feed; ok: boolean }> {
  try {
    const f = await json<unknown>('feed.json', fresh ? { cache: 'no-cache' } : undefined);
    if (validFeed(f)) return { feed: { ...EMPTY_FEED, ...f, config: f.config ?? {} }, ok: true };
  } catch {
    /* feed non ancora pubblicato o offline */
  }
  return { feed: EMPTY_FEED, ok: false };
}
