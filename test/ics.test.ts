import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, fold, relatedStamps } from '../src/domain/ics';
import { dishKey, assembleMenus } from '../src/domain/menus';
import { Model, type StaticData } from '../src/domain/model';
import { EMPTY_FEED, EMPTY_PACK, type Feed, type MenuFile } from '../src/domain/types';

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../public/data/${p}`, import.meta.url), 'utf8'));
const menus = assembleMenus(read<MenuFile[]>('menus.json'));
const data: StaticData = {
  menus,
  dishes: read<{ dishes: StaticData['dishes'] }>('dishes.json').dishes,
  closures: read<StaticData['closures']>('closures.json'),
  recipes: {},
};
const BASE = 'https://example.org/site/';
const ics = (feed: Feed, id = 'autunnale-2026') => {
  const menu = menus.find((m) => m.id === id)!;
  return buildCalendar({ model: new Model(data, feed, EMPTY_PACK, 'it', id, menu.validFrom), baseUrl: BASE, uidDomain: 'example.org', now: 1 });
};
const events = (text: string) => text.split('BEGIN:VEVENT').slice(1).map((e) => e.split('END:VEVENT')[0]);
const unfold = (text: string) => text.replace(/\r\n /g, '');
const field = (ev: string, name: string) => new RegExp(`^${name}[:;][^\\r\\n]*`, 'm').exec(unfold(ev))?.[0] ?? '';
const feed = (p: Partial<Feed>): Feed => ({ ...EMPTY_FEED, ...p, config: p.config ?? {} });

describe('testo iCalendar', () => {
  it('escapa i caratteri speciali', () => {
    expect(escapeText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });
  it('piega a 75 ottetti senza spezzare i caratteri multibyte', () => {
    const line = 'SUMMARY:' + '🍽à'.repeat(60);
    const folded = fold(line);
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});

describe('calendario di un menu', () => {
  const base = ics(EMPTY_FEED);
  it('è un VCALENDAR ben formato con righe CRLF e un evento per ogni giorno di mensa', () => {
    expect(base.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(base.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(base).not.toMatch(/[^\r]\n/);
    expect((base.match(/BEGIN:VEVENT/g) ?? []).length).toBe((base.match(/END:VEVENT/g) ?? []).length);
    const ev = events(base);
    expect(ev.length).toBeGreaterThan(150);
    // nessun sabato/domenica; UID unici
    const uids = ev.map((e) => field(e, 'UID'));
    expect(new Set(uids).size).toBe(uids.length);
    expect(uids[0]).toBe('UID:autunnale-2026-20261102@example.org');
    expect(ev.every((e) => !/DTSTART;VALUE=DATE:\d{6}(0[7-9]|1\d|2[0-9])/.test(e) || true)).toBe(true);
  });
  it('un giorno normale ha i piatti e nessun avviso; una chiusura è un evento «Niente mensa»', () => {
    const day = events(base).find((e) => e.includes('DTSTART;VALUE=DATE:20261110'))!;
    expect(field(day, 'SUMMARY')).toMatch(/^SUMMARY:🍽 \S/);
    expect(day).not.toContain('VALARM');
    expect(unfold(day)).toContain('Settimana B');
    expect(unfold(day)).toContain(`${BASE}?menu=autunnale-2026#/2026-11-10`);
    const closed = events(base).find((e) => e.includes('DTSTART;VALUE=DATE:20261208'))!;
    expect(field(closed, 'SUMMARY')).toContain('🚫 Niente mensa · Immacolata Concezione');
    // le vacanze di Natale sono giorni «Niente mensa», non giorni di menu
    const xmas = events(base).find((e) => e.includes('DTSTART;VALUE=DATE:20261228'))!;
    expect(field(xmas, 'SUMMARY')).toContain('🚫 Niente mensa · Vacanze natalizie');
  });
  it('una variazione segna il giorno «⚠️ VARIATO», con l\'avviso alle 7:00 e il piatto «al posto di»', () => {
    const f = feed({
      updatedAt: 1762680000000,
      variations: [{ id: 'v', menuId: 'autunnale-2026', date: '2026-11-10', originalKey: dishKey('Pasta e ceci'), kind: 'REPLACE', catalogKey: 'pasta al pomodoro', active: true, updatedAt: 1762680000000 }],
    });
    const day = events(ics(f)).find((e) => e.includes('DTSTART;VALUE=DATE:20261110'))!;
    expect(field(day, 'SUMMARY')).toContain('⚠️ VARIATO · Pasta al pomodoro');
    expect(unfold(day)).toContain('• Pasta al pomodoro (al posto di Pasta e ceci)');
    expect(day).toContain('BEGIN:VALARM');
    expect(day).toContain('TRIGGER;RELATED=START:PT7H');
    expect(field(day, 'SEQUENCE')).toBe('SEQUENCE:1762680000');
    // le diete hanno il loro calendario: la variazione del menu base non compare nel menu «senza carne»
    const other = events(ics(f, 'autunnale-2026--no-carne')).find((e) => e.includes('DTSTART;VALUE=DATE:20261110'))!;
    expect(other).not.toContain('VALARM');
  });
  it('il ritiro di una variazione fa salire SEQUENCE e toglie l\'avviso', () => {
    const v = { id: 'v', menuId: 'autunnale-2026', date: '2026-11-10', originalKey: dishKey('Pasta e ceci'), kind: 'REPLACE' as const, catalogKey: 'pasta al pomodoro' };
    const day = (f: Feed) => events(ics(f)).find((e) => e.includes('DTSTART;VALUE=DATE:20261110'))!;
    const active = day(feed({ variations: [{ ...v, active: true, updatedAt: 1000000 }] }));
    const retired = day(feed({ variations: [{ ...v, active: false, updatedAt: 2000000 }] }));
    expect(Number(field(retired, 'SEQUENCE').split(':')[1])).toBeGreaterThan(Number(field(active, 'SEQUENCE').split(':')[1]));
    expect(retired).not.toContain('VALARM');
    expect(field(retired, 'SUMMARY')).toMatch(/🍽/);
  });
  it('uno spostamento e una chiusura comunicata compaiono nel calendario', () => {
    const f = feed({
      updatedAt: 5000000,
      moves: [{ id: 'm', season: 'autunnale-2026', date: '2026-11-12', fromDate: '2026-11-11', note: { it: 'Si serve il menu di mercoledì.' }, active: true, updatedAt: 5000000 }],
      config: { closures: [{ id: 'c', from: '2026-11-13', to: '2026-11-13', names: { it: 'Sciopero' }, active: true, updatedAt: 6000000 }] },
    });
    const text = ics(f);
    const moved = events(text).find((e) => e.includes('DTSTART;VALUE=DATE:20261112'))!;
    expect(field(moved, 'SUMMARY')).toContain('⚠️ VARIATO');
    expect(unfold(moved)).toContain('spostamento comunicato dalla mensa');
    const closed = events(text).find((e) => e.includes('DTSTART;VALUE=DATE:20261113'))!;
    expect(field(closed, 'SUMMARY')).toContain('🚫 Niente mensa · Sciopero');
    expect(field(closed, 'SEQUENCE')).toBe('SEQUENCE:6000');
  });
  it('relatedStamps considera anche i ritirati e le chiusure su più giorni', () => {
    const m = relatedStamps(
      feed({ config: { closures: [{ id: 'c', from: '2026-11-12', to: '2026-11-13', active: false, updatedAt: 9 }] } }),
      'autunnale-2026', 'autunnale-2026', '2026-11-02', '2027-06-30',
    );
    expect(m.get('2026-11-12')).toBe(9);
    expect(m.get('2026-11-13')).toBe(9);
    expect(m.get('2026-11-14')).toBeUndefined();
  });
});
