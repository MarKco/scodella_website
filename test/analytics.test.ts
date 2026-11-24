// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countVisit } from '../src/analytics';

const w = window as unknown as { goatcounter?: unknown };

function addScript(): HTMLScriptElement {
  const s = document.createElement('script');
  s.setAttribute('data-goatcounter', 'https://scodella.goatcounter.com/count');
  document.head.append(s);
  return s;
}

/** Un finto GoatCounter con la stessa forma di quello vero: `count` invia ciò che `get_data` compone, query dell'indirizzo compresa. */
function fakeGoatCounter(sent: Record<string, unknown>[]) {
  const gc = {
    get_data: (vars: { path?: string; title?: string } = {}) => ({ p: vars.path, t: vars.title, q: location.search, r: document.referrer }),
    count: (vars: { path: string; title: string }) => void sent.push(gc.get_data(vars)),
  };
  w.goatcounter = gc;
}

describe('contatore di visite', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/?menu=autunnale-2026--no-carne&saved=a|b&lang=hi&names=Anna|Luca#/2026-11-10');
  });
  afterEach(() => {
    document.head.querySelectorAll('script[data-goatcounter]').forEach((s) => s.remove());
    delete w.goatcounter;
    vi.unstubAllGlobals();
  });

  it('conta una visita come pagina «/», senza query: né menu, né lingua, né nomi', () => {
    const sent: Record<string, unknown>[] = [];
    addScript();
    fakeGoatCounter(sent);
    countVisit();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ p: '/', q: '' });
    expect(JSON.stringify(sent[0])).not.toMatch(/menu|saved|lang|names|Anna|Luca/);
  });

  it('se lo script non è ancora caricato aspetta il caricamento', () => {
    const sent: Record<string, unknown>[] = [];
    const script = addScript();
    countVisit();
    fakeGoatCounter(sent);
    expect(sent).toHaveLength(0);
    script.dispatchEvent(new Event('load'));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ p: '/', q: '' });
  });

  it('con «Do Not Track» non invia nulla', () => {
    vi.stubGlobal('navigator', { ...navigator, doNotTrack: '1' });
    const sent: Record<string, unknown>[] = [];
    addScript();
    fakeGoatCounter(sent);
    countVisit();
    expect(sent).toHaveLength(0);
  });

  it('senza lo script (sviluppo, test, fork senza contatore) non fa niente', () => {
    const sent: Record<string, unknown>[] = [];
    fakeGoatCounter(sent);
    countVisit();
    expect(sent).toHaveLength(0);
  });

  it('con il vero count.js di GoatCounter la richiesta non contiene menu, lingua né nomi', () => {
    let real: string;
    try {
      real = readFileSync(process.env.GC_COUNT_JS ?? '', 'utf8');
    } catch {
      return; // il file vero si scarica a mano (GC_COUNT_JS=percorso): non serve la rete per la suite
    }
    const beacons: string[] = [];
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: (u: string) => (beacons.push(u), true) });
    addScript().setAttribute('data-goatcounter-settings', '{"no_onload":true,"allow_local":true}');
    new Function(real).call(window); // eslint-disable-line no-new-func
    countVisit();
    expect(beacons).toHaveLength(1);
    const q = new URL(beacons[0]);
    expect(q.hostname).toBe('scodella.goatcounter.com');
    expect(q.searchParams.get('p')).toBe('/');
    expect(beacons[0]).not.toMatch(/menu|saved|lang|names|Anna|Luca|autunnale/);
  });
});
