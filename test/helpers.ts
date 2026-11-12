import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMPTY_FEED, EMPTY_PACK, type Feed, type LangPack, type MenuFile } from '../src/domain/types';
import { assembleMenus } from '../src/domain/menus';
import { Model, type StaticData } from '../src/domain/model';
import { I18n } from '../src/i18n';
import { activeMenuId, type Prefs } from '../src/prefs';
import type { Ctx } from '../src/ui/ctx';

const read = <T>(p: string): T => JSON.parse(readFileSync(join(process.cwd(), 'public/data', p), 'utf8'));

export const menuFiles = read<MenuFile[]>('menus.json');
export const menus = assembleMenus(menuFiles);
export const data: StaticData = {
  menus,
  dishes: read<{ dishes: StaticData['dishes'] }>('dishes.json').dishes,
  closures: read<StaticData['closures']>('closures.json'),
  recipes: read<StaticData['recipes']>('recipes.json'),
};
export const packIt = read<LangPack>('lang/it.json');
export const packEn = read<LangPack>('lang/en.json');

/** Un feed con una variazione, un piatto eliminato, uno spostamento e una chiusura (come nelle prove a mano). */
export const sampleFeed: Feed = {
  ...EMPTY_FEED,
  updatedAt: 1762680000000,
  variations: [
    { id: 'v1', menuId: 'autunnale-2026', date: '2026-11-10', originalKey: 'pasta e ceci', kind: 'REPLACE', catalogKey: 'pasta al pomodoro', active: true, updatedAt: 1762680000000 },
    { id: 'v2', menuId: 'autunnale-2026', date: '2026-11-10', originalKey: 'fagiolini all olio', kind: 'DELETE', active: true, updatedAt: 1762680000000 },
  ],
  moves: [{ id: 'm1', season: 'autunnale-2026', date: '2026-11-12', fromDate: '2026-11-11', note: { it: 'Si serve il menu di mercoledì.' }, active: true, updatedAt: 1762680000000 }],
  config: { closures: [{ id: 'c1', from: '2026-11-13', to: '2026-11-13', names: { it: 'Sciopero del personale' }, active: true, updatedAt: 1762680000000 }] },
};

export const basePrefs: Prefs = {
  profiles: [{ id: 'p1', name: '', menuId: 'autunnale-2026' }],
  activeId: 'p1',
  lang: 'it',
  theme: 'system',
  foods: ['EGGS', 'MEAT'],
  welcomed: true,
  dismissed: [],
  iosHintDismissed: false,
  playBannerDismissed: false,
  profileHintDismissed: false,
  startFamily: false,
  familyDiffOnly: false,
};

export function makeCtx(over: { prefs?: Partial<Prefs>; feed?: Feed; today?: string; lang?: 'it' | 'en'; family?: boolean; viewDate?: string | null } = {}): Ctx {
  const today = over.today ?? '2026-11-10';
  const prefs = { ...basePrefs, ...over.prefs };
  const lang = over.lang ?? 'it';
  const pack = lang === 'it' ? packIt : packEn;
  const model = new Model(data, over.feed ?? sampleFeed, lang === 'it' ? EMPTY_PACK : pack, lang, activeMenuId(prefs), today);
  const noop = () => {};
  const feed = over.feed ?? sampleFeed;
  return {
    model,
    modelFor: (menuId: string) => new Model(data, feed, lang === 'it' ? EMPTY_PACK : pack, lang, menuId, today),
    isFamily: over.family ?? false,
    viewDate: over.viewDate ?? null,
    i18n: new I18n(lang, pack, packEn),
    prefs,
    feedOk: true,
    today,
    go: noop,
    patch: noop,
    rerender: noop,
    setActiveProfile: noop,
    addProfile: noop,
    updateProfile: noop,
    removeProfile: noop,
    setProfiles: noop,
    restartWelcome: noop,
    setLang: async () => {},
    openDish: noop,
    toast: noop,
    install: { available: true, installed: false, ios: false, prompt: async () => {} },
  };
}
