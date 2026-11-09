import { describe, expect, it } from 'vitest';
import { MAX_PROFILES } from '../src/prefs';
import { applyState, parseState, startSearch } from '../src/urlstate';

describe('stato nell\'indirizzo', () => {
  it('legge menu, profili (anche con lo stesso menu), profilo attivo e lingua', () => {
    expect(parseState('?menu=b&saved=a|b|b&p=3&lang=hi')).toEqual({ menu: 'b', saved: ['a', 'b', 'b'], active: 2, lang: 'hi', names: [] });
  });
  it('compatibile con gli indirizzi della prima versione (senza p)', () => {
    expect(parseState('?menu=autunnale-2026--no-carne&saved=autunnale-2026|autunnale-2026--no-carne&lang=hi')).toMatchObject({ active: 1 });
    expect(parseState('?menu=a')).toMatchObject({ saved: [], active: undefined, menu: 'a' });
  });
  it('scarta valori strani e limita al massimo dei profili', () => {
    expect(parseState('?menu=<script>&saved=a|b c|ok-1|x|y|z|w&p=9&lang=%20')).toMatchObject({ menu: undefined, saved: ['a', 'ok-1', 'x', 'y', 'z'], active: undefined, lang: undefined });
    expect(parseState('?saved=' + Array.from({ length: MAX_PROFILES + 3 }, (_, i) => `m${i}`).join('|')).saved).toHaveLength(MAX_PROFILES);
    expect(parseState('')).toEqual({ menu: undefined, saved: [], active: undefined, lang: undefined, names: [] });
  });
  it('riscrive la scelta senza toccare gli altri parametri', () => {
    expect(applyState('?oggi=2026-11-14', { menu: 'a', saved: ['a', 'b'], active: 1, lang: 'it' })).toBe('?oggi=2026-11-14&menu=a&saved=a|b&p=2&lang=it');
    expect(applyState('', { menu: 'a', saved: ['a'], active: 0, lang: null })).toBe('?menu=a');
    expect(applyState('?menu=a&saved=a|b&p=2&lang=it', { menu: null, saved: [], lang: null })).toBe('');
  });
});

describe('privacy: i nomi dei bambini', () => {
  it('non finiscono mai nell\'indirizzo visibile: applyState toglie sempre `names`', () => {
    expect(applyState('?names=Giulia|Marco&menu=a', { menu: 'a', saved: ['a', 'a'], active: 0, lang: null })).toBe('?menu=a&saved=a|a&p=1');
    expect(applyState('?names=Giulia', { menu: null, saved: [], lang: null })).toBe('');
  });
  it('compaiono solo nello start_url del manifest (startSearch), ripuliti', () => {
    expect(startSearch('?menu=a&saved=a|b&p=1', ['Giulia', ''])).toBe('?menu=a&saved=a|b&p=1&names=Giulia|');
    expect(startSearch('?menu=a', ['', ''])).toBe('?menu=a');
    expect(startSearch('?menu=a', ['Gi|ulia'])).toBe('?menu=a&names=Gi+ulia');
  });
  it('si leggono dallo start_url al primo avvio', () => {
    expect(parseState('?menu=a&saved=a|b&p=1&names=Giulia|Marco').names).toEqual(['Giulia', 'Marco']);
    expect(parseState('?names=' + 'x'.repeat(100)).names[0]).toHaveLength(24);
  });
});
