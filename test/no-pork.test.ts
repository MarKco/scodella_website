// @vitest-environment jsdom
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { buildCalendar } from '../src/domain/ics';
import { withDerivedNames, NO_PORK_SOURCE } from '../src/domain/derived';
import { addDays, isWeekend } from '../src/domain/dates';
import { buildFamily } from '../src/domain/family';
import { menuPicker } from '../src/ui/components';
import { dayView } from '../src/ui/dayView';
import { Model } from '../src/domain/model';
import { servesPork } from '../src/domain/recipes';
import { computeStats } from '../src/domain/stats';
import { EMPTY_FEED, EMPTY_PACK, type Feed } from '../src/domain/types';
import { I18n } from '../src/i18n';
import { data, makeCtx, menus, packEn } from './helpers';

const BASE = 'autunnale-2026';
const NO_CARNE = `${BASE}--no-carne`;
const NO_PORK = `${BASE}--no-maiale`;
const LONZA = 'lonza di maiale con salsa alle carote';
const START = '2026-11-02';

const model = (id: string, feed: Feed = EMPTY_FEED, pack = EMPTY_PACK, lang = 'it') => new Model(data, feed, pack, lang, id, START);
const feed = (p: Partial<Feed>): Feed => ({ ...EMPTY_FEED, ...p, config: p.config ?? {} });
/** Tutti i giorni di mensa del periodo coperto dal menu standard (fino a fine gennaio basta a coprire più cicli di 5 settimane). */
const days = (m: Model, n = 100) => Array.from({ length: n }, (_, i) => addDays(START, i)).filter((d) => !isWeekend(d) && m.content(d));
const texts = (m: Model, d: string) => m.content(d)!.entries.map((e) => e.text);

describe('menu «Senza maiale»', () => {
  const standard = model(BASE);
  const noPork = model(NO_PORK);
  const porkDays = days(standard).filter((d) => standard.content(d)!.entries.some((e) => e.originalKey === LONZA));

  it('si costruisce dal menu standard e da «Senza carne», e sta subito dopo «Senza carne» nell’elenco', () => {
    const m = menus.find((x) => x.id === NO_PORK)!;
    expect(m).toMatchObject({ diet: 'no-maiale', season: BASE, derived: { rule: 'NO_PORK', base: BASE, substitute: NO_CARNE }, restrictions: [] });
    const order = (id: string) => menus.find((x) => x.id === id)!.order!;
    expect(order(NO_PORK)).toBeGreaterThan(order(NO_CARNE));
    expect(order(NO_PORK)).toBeLessThan(Math.min(...menus.filter((x) => x.order! > order(NO_CARNE)).map((x) => x.order!)) + 0.0001);
  });

  it('il lunedì della settimana C serve la ricotta al posto della lonza, come il menu «Senza carne»', () => {
    expect(porkDays.length).toBeGreaterThan(0);
    const d = porkDays[0];
    const e = noPork.content(d)!.entries.find((x) => x.slot === standard.content(d)!.entries.find((s) => s.originalKey === LONZA)!.slot)!;
    expect(e.text).toBe('Ricotta');
    expect(e.instead).toBe('Lonza di maiale con salsa alle carote');
    expect(texts(noPork, d)).not.toContain('Lonza di maiale con salsa alle carote');
  });

  it('negli altri giorni è identico al menu standard, in ogni giorno dell’anno scolastico', () => {
    const all = days(standard, 330);
    expect(all.length).toBeGreaterThan(150);
    const diff = all.filter((d) => texts(standard, d).join('|') !== texts(noPork, d).join('|'));
    // gli unici giorni diversi sono quelli in cui il menu standard ha la lonza (una volta ogni 5 settimane)
    expect(diff).toEqual(all.filter((d) => standard.content(d)!.entries.some((e) => e.originalKey === LONZA)));
    expect(diff.length).toBeGreaterThan(3);
    for (const d of all) expect(noPork.content(d)!.day.week).toBe(standard.content(d)!.day.week);
  });

  it('eredita variazioni e spostamenti comunicati per il menu standard', () => {
    const d = '2026-11-10';
    const first = standard.content(d)!.entries[0];
    const f = feed({
      variations: [{ id: 'v1', menuId: BASE, date: d, originalKey: first.originalKey, kind: 'DELETE', active: true, updatedAt: 5 }],
      moves: [{ id: 'm1', season: BASE, date: '2026-11-12', fromDate: '2026-11-11', note: { it: 'Menu di mercoledì' }, active: true, updatedAt: 5 }],
    });
    const m = model(NO_PORK, f);
    expect(m.content(d)!.entries.find((e) => e.originalKey === first.originalKey)).toMatchObject({ deleted: true });
    expect(m.content('2026-11-12')!.moved).toMatchObject({ from: '2026-11-11', note: 'Menu di mercoledì' });
    expect(m.content('2026-11-12')!.entries.map((e) => e.text)).toEqual(model(BASE, f).content('2026-11-12')!.entries.map((e) => e.text));
  });

  it('un piatto di maiale introdotto da una variazione si sostituisce; uno eliminato dalla mensa no', () => {
    const d = '2026-11-10';
    const [first, second] = standard.content(d)!.entries;
    const f = feed({
      variations: [
        { id: 'v1', menuId: BASE, date: d, originalKey: first.originalKey, kind: 'REPLACE', catalogKey: LONZA, active: true, updatedAt: 1 },
        { id: 'v2', menuId: BASE, date: '2026-11-17', originalKey: 'x', kind: 'DELETE', active: true, updatedAt: 1 },
      ],
    });
    expect(texts(model(BASE, f), d).join()).toContain('Lonza');
    expect(texts(model(NO_PORK, f), d).join()).not.toContain('Lonza');
    expect(second).toBeDefined();
    // eliminata: resta «Non previsto», nessuna sostituzione
    const porkDay = porkDays[0];
    const g = feed({ variations: [{ id: 'v3', menuId: BASE, date: porkDay, originalKey: LONZA, kind: 'DELETE', active: true, updatedAt: 1 }] });
    expect(model(NO_PORK, g).content(porkDay)!.entries.find((e) => e.originalKey === LONZA)).toMatchObject({ deleted: true, instead: null });
  });

  it('le statistiche delle variazioni sono quelle del menu standard', () => {
    const d = '2026-11-10';
    const first = standard.content(d)!.entries[0];
    const f = feed({ variations: [{ id: 'v1', menuId: BASE, date: d, originalKey: first.originalKey, kind: 'REPLACE', catalogKey: 'pasta al pomodoro', active: true, updatedAt: 1 }] });
    const a = computeStats(model(BASE, f), START, '2026-11-30');
    const b = computeStats(model(NO_PORK, f), START, '2026-11-30');
    expect(b.replaced).toBe(1);
    expect(b).toEqual(a);
  });

  it('nella vista «Tutti» differisce dal menu standard solo nella portata della lonza', () => {
    const col = (id: string, menuId: string) => ({ id, label: id, menuTitle: '', menuId, model: model(menuId) });
    const fam = (d: string) => buildFamily([col('a', BASE), col('b', NO_PORK)], d);
    expect(fam(porkDays[0]).differentCount).toBe(1);
    expect(fam(porkDays[0]).rows.find((r) => r.differs)!.category).toBe('SECONDO');
    expect(fam('2026-11-10').differentCount).toBe(0);
  });

  it('il calendario .ics ha la ricotta e «al posto di», e cambia quando cambia una variazione del menu standard', () => {
    const build = (f: Feed) => buildCalendar({ model: model(NO_PORK, f), baseUrl: 'https://example.org/', uidDomain: 'example.org', now: 1 });
    const text = build(EMPTY_FEED).replace(/\r\n /g, '');
    expect(text).toContain('Ricotta');
    expect(text).toContain('(al posto di: Lonza di maiale con salsa alle carote)');
    const f = feed({ updatedAt: 9, variations: [{ id: 'v1', menuId: BASE, date: '2026-11-10', originalKey: 'x', kind: 'DELETE', active: true, updatedAt: 9000 }] });
    expect(build(f)).toContain('SEQUENCE:9');
  });
});

describe('riconoscere il maiale (rete di sicurezza sui dati)', () => {
  it('nel catalogo solo la lonza è di maiale: un piatto nuovo non marcato farebbe fallire questo test', () => {
    const recipes = data.recipes[BASE];
    const pork = Object.keys(data.dishes).filter((k) => servesPork(recipes, k));
    expect(pork.sort()).toEqual([LONZA, `${LONZA} s farina`]);
  });
  it('riconosce il maiale dal nome e dagli ingredienti, non solo dal flag', () => {
    expect(servesPork(undefined, 'pizza al prosciutto cotto')).toBe(true);
    expect(servesPork(undefined, 'pasta al pomodoro')).toBe(false);
    const recipes = { links: { 'ragu bianco': 'r1' }, recipes: { r1: { name: 'Ragù', ingredients: ['i1'], allergens: [], traces: [], flags: [], tags: [], url: null } }, ingredients: { i1: { name: 'Pancetta' } } };
    expect(servesPork(recipes, 'ragu bianco')).toBe(true);
  });
});

describe('nomi e interfaccia del menu «Senza maiale»', () => {
  it('ha il nome nella lingua in uso, anche dove l’app non lo conosce', () => {
    const en = new I18n('en', packEn, packEn);
    const named = withDerivedNames(packEn, menus, (k) => en.t(k));
    const m = new Model(data, EMPTY_FEED, named, 'en', NO_PORK, START);
    expect(m.names.menuTitle(m.menu!)).toBe('No pork');
    expect(m.names.menu(m.menu!)).toMatch(/– No pork$/);
    const it = new Model(data, EMPTY_FEED, withDerivedNames(EMPTY_PACK, menus, (k) => new I18n('it', EMPTY_PACK, EMPTY_PACK).t(k)), 'it', NO_PORK, START);
    expect(it.names.menuTitle(it.menu!)).toBe('Senza maiale');
  });

  it('il selettore lo offre accanto alle altre diete e la pagina del giorno spiega la regola con il link al Comune', async () => {
    const ctx = makeCtx({ prefs: { profiles: [{ id: 'p1', name: '', menuId: NO_PORK }], activeId: 'p1' } });
    const picker = menuPicker(ctx, () => {});
    expect(picker.textContent).toContain('Senza maiale');
    const standardDay = (ctx.model.menu?.derived && new Model(data, EMPTY_FEED, EMPTY_PACK, 'it', BASE, START).content('2026-11-16')) || null;
    expect(standardDay).not.toBeNull();
    const view = dayView(ctx, '2026-11-16');
    document.body.append(view);
    expect(view.textContent).toContain('Ricotta');
    expect(view.textContent).toContain('Nel menu standard: Lonza di maiale con salsa alle carote');
    expect(view.querySelector<HTMLAnchorElement>('.derived-note a')?.href).toBe(NO_PORK_SOURCE);
    const result = await axe.run(view, { rules: { region: { enabled: false } } });
    expect(result.violations).toEqual([]);
    view.remove();
    // sulle giornate senza maiale non c'è «al posto di»
    expect(dayView(ctx, '2026-11-10').textContent).not.toContain('Nel menu standard');
  });
});
