// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { h } from '../src/dom';
import { focusKey, restoreFocus } from '../src/focus';
import { safeHttpUrl } from '../src/links';
import { sanitizePrefs } from '../src/prefs';
import { viewChanged } from '../src/route';
import { contrast, accentScheme, parseHex, readable, type RGB } from '../src/domain/theme';
import { escapeText } from '../src/domain/ics';

describe('h(): attributi ARIA booleani', () => {
  it('true e false diventano "true" e "false" (mai omessi o vuoti)', () => {
    const el = h('button', { 'aria-pressed': true, 'aria-checked': false, 'aria-current': undefined, hidden: true });
    expect(el.getAttribute('aria-pressed')).toBe('true');
    expect(el.getAttribute('aria-checked')).toBe('false');
    expect(el.hasAttribute('aria-current')).toBe(false);
    expect(el.hasAttribute('hidden')).toBe(true);
    expect(h('input', { readonly: false }).hasAttribute('readonly')).toBe(false);
  });
});

describe('focus', () => {
  it('ritrova il controllo dopo il ridisegno tramite la chiave', () => {
    const root = document.createElement('div');
    document.body.append(root);
    root.append(h('button', { 'data-fk': 'day-next' }, 'Avanti'));
    const btn = root.querySelector('button')!;
    btn.focus();
    expect(focusKey(root)).toBe('day-next');
    root.replaceChildren(h('button', { 'data-fk': 'day-next' }, 'Avanti'));
    expect(document.activeElement).toBe(document.body);
    expect(restoreFocus(root, 'day-next')).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('button'));
    expect(restoreFocus(root, 'non-esiste')).toBe(false);
    expect(restoreFocus(root, 'a"]b')).toBe(false); // chiave non sicura: mai dentro un selettore
  });
  it('senza focus nell\'app non c\'è nessuna chiave', () => {
    const root = document.createElement('div');
    document.body.append(root);
    expect(focusKey(root)).toBeNull();
  });
});

describe('route: la vista «Tutti»', () => {
  it('cambiare giorno dentro «Tutti» = si torna in cima; da «Tutti» alla pagina del giorno = altra vista', () => {
    expect(viewChanged({ name: 'family', date: '2026-11-10' }, { name: 'family', date: '2026-11-11' })).toBe(true);
    expect(viewChanged({ name: 'family', date: '2026-11-10' }, { name: 'family', date: '2026-11-10' })).toBe(false);
    expect(viewChanged({ name: 'family', date: '2026-11-10' }, { name: 'day', date: '2026-11-10' })).toBe(true);
  });
});

describe('route: cambio di vista', () => {
  it('stessa vista (opzione, periodo, mese) = nessun salto in cima', () => {
    expect(viewChanged({ name: 'settings' }, { name: 'settings' })).toBe(false);
    expect(viewChanged({ name: 'stats', period: '7' }, { name: 'stats', period: 'year' })).toBe(false);
    expect(viewChanged({ name: 'calendar', month: '2026-11' }, { name: 'calendar', month: '2026-12' })).toBe(false);
    expect(viewChanged({ name: 'day', date: '2026-11-10' }, { name: 'day', date: '2026-11-10' })).toBe(false);
  });
  it('altra vista o altro giorno = si torna in cima', () => {
    expect(viewChanged(null, { name: 'settings' })).toBe(true);
    expect(viewChanged({ name: 'settings' }, { name: 'stats', period: '7' })).toBe(true);
    expect(viewChanged({ name: 'day', date: '2026-11-10' }, { name: 'day', date: '2026-11-11' })).toBe(true);
  });
});

describe('preferenze salvate corrotte', () => {
  it('non lanciano mai e tornano ai valori validi', () => {
    const p = sanitizePrefs({ lang: '../../x', dismissed: 7, theme: { a: 1 }, foods: null, profiles: 'zz', menuId: '<script>', welcomed: 'yes', playBannerDismissed: 1 });
    expect(p).toMatchObject({ lang: null, dismissed: [], theme: 'system', foods: [], profiles: [], activeId: null, welcomed: false, playBannerDismissed: false });
    expect(sanitizePrefs(null).theme).toBe('system');
    expect(sanitizePrefs([1, 2]).profiles).toEqual([]);
    expect(sanitizePrefs('testo').activeId).toBeNull();
  });
  it('ricorda l\'ultima vista e il filtro «solo le differenze» solo se sono veri booleani', () => {
    expect(sanitizePrefs({ startFamily: true, familyDiffOnly: true })).toMatchObject({ startFamily: true, familyDiffOnly: true });
    expect(sanitizePrefs({ startFamily: 'sì', familyDiffOnly: 1 })).toMatchObject({ startFamily: false, familyDiffOnly: false });
  });
  it('tiene i valori validi e scarta solo quelli sbagliati', () => {
    const p = sanitizePrefs({ lang: 'hi', theme: 'dark', foods: ['EGGS', 'PIZZA', 5], profiles: [{ id: 'p1', name: 'Giulia', menuId: 'a' }, { id: 'p2', menuId: 'b c' }, { id: 'p3', menuId: 'd' }], activeId: 'p3', dismissed: ['m@1', 3], welcomed: true });
    expect(p).toMatchObject({ lang: 'hi', theme: 'dark', foods: ['EGGS'], activeId: 'p3', dismissed: ['m@1'], welcomed: true });
    expect(p.profiles.map((x) => [x.name, x.menuId])).toEqual([['Giulia', 'a'], ['', 'd']]);
  });
});

describe('indirizzi presi dai dati', () => {
  it('solo http(s)', () => {
    expect(safeHttpUrl('https://example.org/a?b=1')).toBe('https://example.org/a?b=1');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,x')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe('contrasto del testo con l\'accento', () => {
  const bgs = (a: RGB, dark: boolean) => {
    const v = accentScheme('#' + a.map((x) => x.toString(16).padStart(2, '0')).join(''), dark);
    const num = (k: string) => (v[k].match(/\d+/g) ?? []).map(Number) as RGB;
    return ['--background', '--surface-variant', '--surface-low', '--surface-container', '--surface-high'].map(num);
  };
  const accents = ['#B5501E', '#E8B400', '#1F5FBF', '#2E7D32', '#7B1FA2', '#C62828'];
  for (const hex of accents) {
    it(`--primary-text ≥ 4,5:1 su tutti gli sfondi (${hex}, chiaro e scuro)`, () => {
      for (const dark of [false, true]) {
        const scheme = accentScheme(hex, dark);
        const text = (scheme['--primary-text'].match(/\d+/g) ?? []).map(Number) as RGB;
        for (const bg of bgs(parseHex(hex), dark)) expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it('lascia l\'accento com\'è se ha già abbastanza contrasto', () => {
    expect(readable([20, 20, 20], [[255, 255, 255]], [0, 0, 0])).toEqual([20, 20, 20]);
  });
});

describe('calendario: testo sicuro', () => {
  it('toglie i caratteri di controllo e converte ogni forma di a capo', () => {
    expect(escapeText('a\rb\u0000c\u0007d\r\ne\nf')).toBe('a\\nbcd\\ne\\nf');
  });
});
