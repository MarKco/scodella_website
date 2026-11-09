import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isoWeekday, mondayOf } from '../src/domain/dates';
import { assembleMenus, currentMenu, dishKey, effectiveMenus, lastDay, resolveDay, selectableSeasons } from '../src/domain/menus';
import { effectiveMoves, effectiveVariations, moveSources, pickMessage, pickText, remoteClosures } from '../src/domain/feed';
import { Model, type StaticData } from '../src/domain/model';
import { computeStreak } from '../src/domain/streak';
import { computeStats } from '../src/domain/stats';
import { findRecipe } from '../src/domain/recipes';
import { accentScheme } from '../src/domain/theme';
import { EMPTY_FEED, EMPTY_PACK, type Feed, type LangPack, type MenuFile, type SeasonRecipes } from '../src/domain/types';

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../public/data/${p}`, import.meta.url), 'utf8'));
const files = read<MenuFile[]>('menus.json');
const menus = assembleMenus(files, (id, e) => {
  throw new Error(`menu scartato ${id}: ${e}`);
});
const base = menus.find((m) => m.id === 'autunnale-2026')!;
const noCarne = menus.find((m) => m.id === 'autunnale-2026--no-carne')!;
const data: StaticData = {
  menus,
  dishes: read<{ dishes: StaticData['dishes'] }>('dishes.json').dishes,
  closures: read<StaticData['closures']>('closures.json'),
  recipes: read<Record<string, SeasonRecipes>>('recipes.json'),
};
const it_: LangPack = read<LangPack>('lang/it.json');
const en: LangPack = read<LangPack>('lang/en.json');
const feed = (patch: Partial<Feed>): Feed => ({ ...EMPTY_FEED, ...patch, config: { ...(patch.config ?? {}) } });
const model = (f: Feed = EMPTY_FEED, id: string | null = base.id, today = '2026-11-09', pack = EMPTY_PACK, lang = 'it') =>
  new Model(data, f, pack, lang, id, today);

describe('date', () => {
  it('calcola giorni e settimane', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(diffDays('2026-11-02', '2026-11-30')).toBe(28);
    expect(isoWeekday('2026-11-02')).toBe(1); // lunedì
    expect(isoWeekday('2026-11-08')).toBe(7);
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
  });
});

describe('dishKey', () => {
  it('normalizza come l\'app', () => {
    expect(dishKey("Fagioli all'uccelletto")).toBe('fagioli all uccelletto');
    expect(dishKey('Pasta integrale al ragù di manzo')).toBe('pasta integrale al ragu di manzo');
    expect(dishKey('  Crème  brûlée ')).toBe('creme brulee');
  });
});

describe('menu', () => {
  it('assembla base e diete senza scartare nulla', () => {
    expect(menus).toHaveLength(12);
    expect(menus.filter((m) => m.diet === null)).toHaveLength(1);
    expect(noCarne.restrictions).toContain('MEAT');
  });

  it('la prima settimana parte dal lunedì di validFrom e ruota ogni lunedì', () => {
    const w = (d: string) => resolveDay(base, d)?.week;
    expect(w('2026-11-02')).toBe('A');
    expect(w('2026-11-06')).toBe('A');
    expect(w('2026-11-09')).toBe('B');
    expect(w('2026-11-30')).toBe('E');
    expect(w('2026-12-07')).toBe('A'); // 5 settimane → ricomincia
    expect(w('2027-01-04')).toBe('E'); // 9 settimane dopo: 9 % 5 = 4 → quinta etichetta
  });

  it('weekend, prima dell\'inizio e dopo la fine non hanno menu', () => {
    expect(resolveDay(base, '2026-11-07')).toBeNull();
    expect(resolveDay(base, '2026-10-30')).toBeNull();
    expect(lastDay(base)).toBe('2027-06-30');
    expect(resolveDay(base, '2027-07-01')).toBeNull();
    expect(resolveDay(base, '2027-06-30')).not.toBeNull();
  });

  it('la dieta eredita le settimane del base e cambia solo i piatti previsti', () => {
    // settimana A, martedì (day 2), slot 1 → «Pasta olio e parmigiano»
    expect(resolveDay(noCarne, '2026-11-03')!.dishes[0].name).toBe('Pasta olio e parmigiano');
    expect(resolveDay(base, '2026-11-03')!.dishes[0].name).not.toBe('Pasta olio e parmigiano');
    expect(resolveDay(noCarne, '2026-11-02')!.dishes).toEqual(resolveDay(base, '2026-11-02')!.dishes);
  });

  it('uno spostamento serve il menu di un altro giorno', () => {
    const moved = resolveDay(base, '2026-11-03', new Map([['2026-11-03', '2026-11-05']]))!;
    const source = resolveDay(base, '2026-11-05')!;
    expect(moved.dishes).toEqual(source.dishes);
    expect(moved.movedFrom).toBe('2026-11-05');
    expect(moved.week).toBe(source.week);
  });

  it('sceglie il menu corrente e la fine pubblicata', () => {
    expect(currentMenu(menus, null, '2026-11-09')!.id).toBe('autunnale-2026');
    expect(currentMenu(menus, noCarne.id, '2026-11-09')!.id).toBe(noCarne.id);
    expect(currentMenu(menus, 'sparito', '2026-11-09')!.id).toBe('autunnale-2026');
    expect(selectableSeasons(menus, '2026-11-09')).toHaveLength(1);
    const cut = effectiveMenus(menus, { menuValidity: { 'autunnale-2026': '2026-12-18' } });
    expect(cut.every((m) => lastDay(m) === '2026-12-18')).toBe(true);
    expect(resolveDay(cut[0], '2026-12-21')).toBeNull();
  });
});

describe('feed', () => {
  const v = (over: object) => ({ id: 'x', menuId: base.id, date: '2026-11-10', originalKey: 'a', kind: 'REPLACE', active: true, updatedAt: 1, ...over }) as Feed['variations'][number];

  it('tiene solo variazioni attive del menu scelto e scarta la forma compatibile degli spostamenti in vigore', () => {
    const f = feed({
      variations: [v({ id: '1' }), v({ id: '2', active: false, originalKey: 'b' }), v({ id: '3', menuId: 'altro', originalKey: 'c' }), v({ id: '4', originalKey: 'd', move: 'm1' })],
    });
    expect([...effectiveVariations(f, base.id, new Set()).get('2026-11-10')!.keys()].sort()).toEqual(['a', 'd']);
    expect([...effectiveVariations(f, base.id, new Set(['m1'])).get('2026-11-10')!.keys()]).toEqual(['a']);
  });

  it('spostamenti: attivi, della stagione, ultimo vince, kill switch', () => {
    const m = (over: object) => ({ id: 'm', season: base.season, date: '2026-11-03', fromDate: '2026-11-05', active: true, updatedAt: 1, ...over }) as Feed['moves'][number];
    const f = feed({ moves: [m({ id: 'a' }), m({ id: 'b', updatedAt: 2, fromDate: '2026-11-06' }), m({ id: 'c', date: '2026-11-04', active: false }), m({ id: 'd', season: 'x' }), m({ id: 'e', date: '2026-11-05', fromDate: '2026-11-05' })] });
    const eff = effectiveMoves(f, base.season);
    expect([...moveSources(eff)]).toEqual([['2026-11-03', '2026-11-06']]);
    expect(effectiveMoves(feed({ ...f, config: { features: { moves: false } } }), base.season).size).toBe(0);
  });

  it('chiusure: valide, attive, kill switch', () => {
    const c = (over: object) => ({ id: 'c', from: '2026-11-12', to: '2026-11-12', active: true, updatedAt: 1, names: { it: 'Sciopero' }, ...over }) as NonNullable<Feed['config']['closures']>[number];
    const f = feed({ config: { closures: [c({}), c({ id: 'r', active: false }), c({ id: 'b', to: '2026-11-01' }), c({ id: 'l', to: '2027-01-30' })] } });
    expect(remoteClosures(f).map((x) => x.id)).toEqual(['c']);
    expect(remoteClosures(feed({ config: { ...f.config, features: { closures: false } } }))).toEqual([]);
  });

  it('testi: lingua, poi inglese, poi italiano', () => {
    expect(pickText({ it: 'ciao', en: 'hi' }, 'hi')).toBe('hi');
    expect(pickText({ it: 'ciao' }, 'hi')).toBe('ciao');
    expect(pickText({}, 'it')).toBeNull();
  });

  it('messaggi: finestra, ritirati e già chiusi', () => {
    const msg = (over: object) => ({ id: 'm', title: { it: 'T' }, body: { it: 'B' }, active: true, updatedAt: 5, ...over }) as Feed['messages'][number];
    expect(pickMessage([msg({})], 10, 'it', new Set())).toEqual({ version: 'm@5', title: 'T', body: 'B' });
    expect(pickMessage([msg({})], 10, 'it', new Set(['m@5']))).toBeNull();
    expect(pickMessage([msg({ to: 5 })], 10, 'it', new Set())).toBeNull();
    expect(pickMessage([msg({ from: 20 })], 10, 'it', new Set())).toBeNull();
    expect(pickMessage([msg({ active: false })], 10, 'it', new Set())).toBeNull();
  });
});

describe('modello', () => {
  it('applica sostituzioni ed eliminazioni della mensa e le traduce', () => {
    const day = resolveDay(base, '2026-11-10')!;
    const [first, second] = day.dishes;
    const f = feed({
      variations: [
        { id: 'v1', menuId: base.id, date: '2026-11-10', originalKey: dishKey(first.name), kind: 'REPLACE', catalogKey: 'pasta al pomodoro', active: true, updatedAt: 1 },
        { id: 'v2', menuId: base.id, date: '2026-11-10', originalKey: dishKey(second.name), kind: 'DELETE', active: true, updatedAt: 1 },
      ],
    });
    const c = model(f).content('2026-11-10')!;
    const e1 = c.entries.find((e) => e.originalKey === dishKey(first.name))!;
    expect(e1.replaced).toBe(true);
    expect(e1.text).toBe('Pasta al pomodoro');
    expect(c.entries.find((e) => e.originalKey === dishKey(second.name))!.deleted).toBe(true);
    // in inglese il piatto noto prende la traduzione del catalogo
    const ce = model(f, base.id, '2026-11-09', en, 'en').content('2026-11-10')!;
    expect(ce.entries.find((e) => e.originalKey === dishKey(first.name))!.text).toBe(en.dishes['pasta al pomodoro']);
  });

  it('un piatto fuori catalogo usa i nomi della variazione nella lingua giusta', () => {
    const key = dishKey(resolveDay(base, '2026-11-10')!.dishes[0].name);
    const f = feed({ variations: [{ id: 'v', menuId: base.id, date: '2026-11-10', originalKey: key, kind: 'REPLACE', names: { it: 'Pizza', en: 'Pizza (en)' }, active: true, updatedAt: 1 }] });
    expect(model(f).content('2026-11-10')!.entries.find((e) => e.originalKey === key)!.text).toBe('Pizza');
    expect(model(f, base.id, '2026-11-09', en, 'en').content('2026-11-10')!.entries.find((e) => e.originalKey === key)!.text).toBe('Pizza (en)');
  });

  it('chiusure: nel calendario e comunicate; non compaiono tra i giorni visibili', () => {
    const m = model();
    expect(m.closure('2026-12-08')!.reason).toBe('Immacolata Concezione');
    expect(m.content('2026-12-08')).toBeNull();
    expect(m.isVisible('2026-12-08')).toBe(false);
    expect(m.step('2026-12-04', 1)).toBe('2026-12-09'); // 7 e 8 chiusi, sab/dom saltati
    expect(m.step('2026-12-09', -1)).toBe('2026-12-04');
    const f = feed({ config: { closures: [{ id: 'c', from: '2026-11-12', to: '2026-11-12', names: { it: 'Sciopero' }, active: true, updatedAt: 1 }] } });
    const mc = model(f);
    expect(mc.closure('2026-11-12')!.reason).toBe('Sciopero');
    expect(mc.content('2026-11-12')).toBeNull();
    expect(mc.step('2026-11-11', 1)).toBe('2026-11-13');
  });

  it('spostamento: contenuto del giorno di origine con banner', () => {
    const f = feed({ moves: [{ id: 'm', season: base.season, date: '2026-11-03', fromDate: '2026-11-05', note: { it: 'straccetti' }, active: true, updatedAt: 1 }] });
    const c = model(f).content('2026-11-03')!;
    expect(c.moved).toEqual({ from: '2026-11-05', note: 'straccetti' });
    expect(c.entries.map((e) => e.original).sort()).toEqual(model().content('2026-11-05')!.entries.map((e) => e.original).sort());
  });

  it('serie dell\'alimento: giorni dall\'ultima e alla prossima volta', () => {
    const on = (d: string) => ['2026-11-02', '2026-11-10'].includes(d);
    expect(computeStreak('2026-11-05', '2026-11-02', '2027-06-30', on)).toEqual({ today: false, daysSinceLast: 3, daysUntilNext: 5 });
    expect(computeStreak('2026-11-02', '2026-11-02', '2027-06-30', on)).toEqual({ today: true, daysSinceLast: null, daysUntilNext: 8 });
    const m = model();
    expect(m.streak('2026-11-10', 'MEAT')).not.toBeNull();
    expect(m.streak('2026-11-07', 'MEAT')).toBeNull(); // sabato
  });

  it('statistiche sulle variazioni della mensa', () => {
    const day = resolveDay(base, '2026-11-10')!;
    const k = dishKey(day.dishes[0].name);
    const f = feed({ variations: [{ id: 'v', menuId: base.id, date: '2026-11-10', originalKey: k, kind: 'REPLACE', catalogKey: 'pasta al pomodoro', active: true, updatedAt: 1 }] });
    const s = computeStats(model(f), '2026-11-02', '2026-11-13');
    expect(s.replaced).toBe(1);
    expect(s.daysWithChanges).toBe(1);
    expect(s.mensaDays).toBe(10);
    expect(s.byWeekday[1]).toBe(1); // martedì
    expect(computeStats(model(), '2026-11-02', '2026-11-13').replaced).toBe(0);
  });
});

describe('ricette e tema', () => {
  it('una dieta che vieta la carne non ammette ricette di carne', () => {
    const recipes = data.recipes[base.season];
    const meatDish = Object.entries(recipes.links).find(([, id]) => recipes.recipes[id].tags.includes('MEAT'));
    expect(meatDish).toBeDefined();
    expect(findRecipe(recipes, base, meatDish![0])).not.toBeNull();
    expect(findRecipe(recipes, noCarne, meatDish![0])).toBeNull();
  });

  it('il tema deriva dall\'accento in chiaro e in scuro', () => {
    const light = accentScheme('#B5501E', false);
    const dark = accentScheme('#B5501E', true);
    expect(light['--primary']).toBe('rgb(181 80 30)');
    expect(light['--background']).not.toBe(dark['--background']);
    expect(accentScheme('malformato', false)['--primary']).toBe('rgb(181 80 30)');
  });
});

// pack italiano caricabile
it('il pacchetto italiano ha le stringhe dell\'interfaccia', () => {
  expect(it_.ui.category_primo).toBe('Primo');
});
