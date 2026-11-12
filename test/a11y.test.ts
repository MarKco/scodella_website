// @vitest-environment jsdom
// Regressioni di accessibilità sulle viste vere, con axe-core in jsdom. jsdom non ha layout: il contrasto dei colori e le
// dimensioni dei bersagli non si misurano qui (il contrasto è coperto da test/theme.test.ts); ruoli, nomi e attributi ARIA sì.
import axe from 'axe-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { clear } from '../src/dom';
import { openSheet, profileBar } from '../src/ui/components';
import { calendarView } from '../src/ui/calendarView';
import { dayView } from '../src/ui/dayView';
import { openDishSheet } from '../src/ui/dishSheet';
import { familyView } from '../src/ui/familyView';
import { settingsView } from '../src/ui/settingsView';
import { statsView } from '../src/ui/statsView';
import { resetWelcomeDraft, welcomeView } from '../src/ui/welcome';
import { composeDay } from '../src/domain/content';
import { MAX_PROFILES } from '../src/prefs';
import { makeCtx } from './helpers';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

beforeAll(() => {
  // jsdom non implementa <dialog>.
  const proto = HTMLDialogElement.prototype as unknown as { showModal: () => void; close: () => void };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  clear(document.body);
  resetWelcomeDraft();
});

async function violations(node: Element) {
  const main = document.createElement('main');
  main.append(node);
  document.body.append(main);
  const result = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false }, region: { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
}

describe('accessibilità (axe-core)', () => {
  it('giorno con variazioni, piatto eliminato e avviso «oggi senza mensa»', async () => {
    expect(await violations(dayView(makeCtx(), '2026-11-10'))).toEqual([]);
    expect(await violations(dayView(makeCtx({ today: '2026-11-14' }), '2026-11-16', '2026-11-14'))).toEqual([]);
  });
  it('giorno di chiusura e giorno spostato', async () => {
    expect(await violations(dayView(makeCtx(), '2026-11-13'))).toEqual([]);
    expect(await violations(dayView(makeCtx(), '2026-11-12'))).toEqual([]);
  });
  it('calendario del mese (tabella) e in inglese', async () => {
    expect(await violations(calendarView(makeCtx(), '2026-11'))).toEqual([]);
    expect(await violations(calendarView(makeCtx({ lang: 'en' }), '2026-12'))).toEqual([]);
  });
  it('variazioni', async () => {
    expect(await violations(statsView(makeCtx(), 'year'))).toEqual([]);
  });
  it('impostazioni, anche con più menu salvati', async () => {
    expect(await violations(settingsView(makeCtx()))).toEqual([]);
    expect(await violations(settingsView(makeCtx({ prefs: { profiles: [{ id: 'p1', name: '', menuId: 'autunnale-2026' }, { id: 'p2', name: 'Giulia', menuId: 'autunnale-2026--no-carne' }], activeId: 'p1' } })))).toEqual([]);
  });
  it('impostazioni con il pannello «aggiungi un menu» aperto', async () => {
    const el = settingsView(makeCtx(), true);
    expect(el.querySelector('#add-panel')).not.toBeNull();
    expect(await violations(el)).toEqual([]);
    expect(settingsView(makeCtx(), false).querySelector('#add-panel')).toBeNull();
  });
  it('impostazioni con le istruzioni del calendario aperte', async () => {
    const el = settingsView(makeCtx(), false, true);
    expect(el.querySelector<HTMLDetailsElement>('#calendar-section details.more')?.open).toBe(true);
    expect(await violations(el)).toEqual([]);
    expect(settingsView(makeCtx()).querySelector<HTMLDetailsElement>('#calendar-section details.more')?.open).toBe(false);
  });
  it('«Aggiungi al calendario» del giorno porta alle istruzioni dove webcal non funziona', () => {
    const links = [...dayView(makeCtx(), '2026-11-10').querySelectorAll('a')];
    // L'ambiente dei test non è un Apple: niente webcal, si va alle impostazioni.
    expect(links.find((a) => a.getAttribute('href') === '#/settings/calendar')).toBeDefined();
    expect(links.some((a) => a.getAttribute('href')?.startsWith('webcal:'))).toBe(false);
  });
  it('riga dei profili in cima', async () => {
    const bar = profileBar(makeCtx())!;
    expect(await violations(bar)).toEqual([]);
    const two = profileBar(makeCtx({ prefs: { profiles: [{ id: 'p1', name: '', menuId: 'autunnale-2026' }, { id: 'p2', name: 'Giulia', menuId: 'autunnale-2026--no-carne' }], activeId: 'p1' } }))!;
    expect(await violations(two)).toEqual([]);
  });
  it('benvenuto', async () => {
    const el = welcomeView(makeCtx({ prefs: { welcomed: false } }), () => {}, () => {});
    expect(await violations(el)).toEqual([]);
    el.querySelector<HTMLButtonElement>('[data-fk="wl-cancel"]')!.click(); // chiude la bozza
  });
  it('foglio del piatto (dialog) con ingredienti', async () => {
    const ctx = makeCtx();
    const day = ctx.model.content('2026-11-10')!;
    const entry = day.entries.find((e) => e.originalKey === 'frittata al forno')!;
    openDishSheet(ctx, entry, '2026-11-10');
    const dlg = document.querySelector('dialog')!;
    expect(dlg.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dlg.querySelector(`#${dlg.getAttribute('aria-labelledby')}`)?.textContent).toBe('Frittata al forno');
    const found = await axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(found.violations.map((v) => v.id)).toEqual([]);
  });
  it('un messaggio generico usa lo stesso dialog', async () => {
    openSheet('Avviso', [document.createTextNode('Testo')], 'Chiudi');
    const found = await axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(found.violations.map((v) => v.id)).toEqual([]);
  });
});

/** Elementi il cui `aria-label` non contiene il testo che si vede (WCAG 2.5.3): jsdom non ha il layout che serve alla regola di axe. */
function labelMismatches(root: Element): string[] {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  return [...root.querySelectorAll('a[aria-label], button[aria-label], [role="button"][aria-label]')]
    .filter((el) => {
      const visible = norm([...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE || !(n as Element).classList?.contains('sr-only')).map((n) => n.textContent ?? '').join(' '));
      return visible !== '' && !norm(el.getAttribute('aria-label') ?? '').includes(visible);
    })
    .map((el) => `${el.tagName.toLowerCase()}[aria-label="${el.getAttribute('aria-label')}"]`);
}

describe('etichetta e testo visibile coincidono', () => {
  it('in tutte le viste', () => {
    const ctx = makeCtx({ prefs: { profiles: [{ id: 'p1', name: '', menuId: 'autunnale-2026' }, { id: 'p2', name: 'Giulia', menuId: 'autunnale-2026--no-carne' }], activeId: 'p1' } });
    for (const view of [dayView(ctx, '2026-11-10'), calendarView(ctx, '2026-11'), statsView(ctx, 'year'), settingsView(ctx), welcomeView(ctx, () => {})]) {
      expect(labelMismatches(view)).toEqual([]);
    }
  });
});

describe('contenuto per screen reader', () => {
  it('un piatto variato o eliminato dice cosa è cambiato, senza aria-label che copra il contenuto', () => {
    const el = dayView(makeCtx(), '2026-11-10');
    const rows = [...el.querySelectorAll('.dish-btn')];
    expect(rows.some((r) => r.hasAttribute('aria-label'))).toBe(false);
    const text = rows.map((r) => r.textContent ?? '');
    expect(text.some((t) => t.includes('variato') && t.includes('Pasta al pomodoro') && t.includes('Pasta e ceci'))).toBe(true);
    expect(text.some((t) => t.includes('Non previsto'))).toBe(true);
  });
  it('le celle del calendario hanno il nome del giorno intero e le chiusure a parole', () => {
    const el = calendarView(makeCtx(), '2026-11');
    const link = el.querySelector('a[href="#/2026-11-10"]')!;
    expect(link.textContent).toContain('martedì, 10 novembre');
    expect(link.textContent).toContain('Variazione del Comune');
    expect(el.querySelector('table')?.querySelector('caption')?.textContent).toMatch(/novembre 2026/);
    expect(el.querySelectorAll('th[scope="col"]')).toHaveLength(7);
    expect(el.querySelector('[aria-label]:not([role])')?.tagName ?? 'nessuno').not.toBe('DIV');
  });
  it('i chip a due stati hanno aria-pressed true/false (mai vuoto né assente)', () => {
    const el = settingsView(makeCtx());
    const chips = [...el.querySelectorAll('.chips button')];
    expect(chips.length).toBeGreaterThan(8);
    for (const c of chips) expect(['true', 'false']).toContain(c.getAttribute('aria-pressed'));
    expect(chips.some((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);
    expect(el.querySelectorAll('[role="radio"], [role="radiogroup"]')).toHaveLength(0);
  });
  it('compose non cambia: variazione e piatto eliminato ci sono nel contenuto', () => {
    const ctx = makeCtx();
    const c = ctx.model.content('2026-11-10')!;
    expect(c.entries.some((e) => e.replaced)).toBe(true);
    expect(c.entries.some((e) => e.deleted)).toBe(true);
    expect(typeof composeDay).toBe('function');
  });
});

describe('profili: riga in cima e benvenuto', () => {
  const two = { profiles: [{ id: 'p1', name: '', menuId: 'autunnale-2026' }, { id: 'p2', name: 'Giulia', menuId: 'autunnale-2026' }], activeId: 'p2' };
  it('con un solo menu: chip che porta alle impostazioni, «＋ Aggiungi» e X per nascondere', () => {
    const bar = profileBar(makeCtx())!;
    expect(bar.querySelector('a.chip.on')?.getAttribute('href')).toBe('#/settings');
    const add = bar.querySelector('a.chip.add')!;
    expect(add.getAttribute('href')).toBe('#/settings/add-menu');
    expect(add.textContent).toContain('Aggiungi');
    expect(bar.querySelector('button[aria-label*="Nascondi"]')).not.toBeNull();
  });
  it('nascosto il suggerimento e con un solo menu la riga sparisce; con due resta senza il «＋»', () => {
    expect(profileBar(makeCtx({ prefs: { profileHintDismissed: true } }))).toBeNull();
    const bar = profileBar(makeCtx({ prefs: { ...two, profileHintDismissed: true } }))!;
    expect(bar.querySelectorAll('button.chip')).toHaveLength(2);
    expect(bar.querySelector('.chip.add')).toBeNull();
  });
  it('con due profili: chip con nome (o menu), stesso menu distinto, aria-pressed sul profilo in uso', () => {
    const bar = profileBar(makeCtx({ prefs: two }))!;
    const chips = [...bar.querySelectorAll('button.chip')];
    expect(chips.map((c) => c.textContent)).toEqual(['Menu standard', 'Giulia']);
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    const same = profileBar(makeCtx({ prefs: { profiles: [{ id: 'p1', name: '', menuId: 'autunnale-2026' }, { id: 'p2', name: '', menuId: 'autunnale-2026' }], activeId: 'p1' } }))!;
    expect([...same.querySelectorAll('button.chip')].map((c) => c.textContent)).toEqual(['Menu standard', 'Menu standard (2)']);
  });
  it('con il massimo di profili non si offre più di aggiungerne', () => {
    const bar = profileBar(makeCtx({ prefs: { profiles: ids(MAX_PROFILES).map((id) => ({ id, name: '', menuId: 'autunnale-2026' })), activeId: 'p1' } }))!;
    expect(bar.querySelector('.chip.add')).toBeNull();
  });
  it('benvenuto a schede: una scheda, poi due; il nome ha etichetta e limite; Continua passa nomi e menu', () => {
    const calls: unknown[] = [];
    const ctx = { ...makeCtx({ prefs: { profiles: [], activeId: null, welcomed: false } }), setProfiles: (l: unknown) => calls.push(l) };
    let el = welcomeView(ctx, () => {});
    expect(el.querySelectorAll('.profile-card')).toHaveLength(1);
    const input = el.querySelector<HTMLInputElement>('input.name-input')!;
    expect(input.getAttribute('maxlength')).toBe('24');
    expect(input.closest('label')?.textContent).toContain('Nome (facoltativo)');
    input.value = 'Giulia';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('[data-fk="wl-add"]')!.click();
    el = welcomeView(ctx, () => {}); // il ridisegno riparte dalle schede in modifica
    expect(el.querySelectorAll('.profile-card')).toHaveLength(2);
    expect(el.querySelector<HTMLInputElement>('input.name-input')!.value).toBe('Giulia');
    for (let n = 2; n < MAX_PROFILES; n++) {
      el.querySelector<HTMLButtonElement>('[data-fk="wl-add"]')!.click();
      el = welcomeView(ctx, () => {});
    }
    expect(el.querySelectorAll('.profile-card')).toHaveLength(MAX_PROFILES);
    expect(el.querySelector('[data-fk="wl-add"]')).toBeNull(); // massimo raggiunto
    el.querySelector<HTMLButtonElement>('[data-fk="wl-continue"]')!.click();
    expect(calls).toEqual([[{ name: 'Giulia', menuId: 'autunnale-2026' }, ...Array.from({ length: MAX_PROFILES - 1 }, () => ({ name: '', menuId: 'autunnale-2026' }))]]);
    expect(welcomeView(ctx, () => {}).querySelectorAll('.profile-card')).toHaveLength(1); // finito: si riparte pulito
  });
});

describe('impostazioni: schede dei bambini e pannello «Nuovo menu»', () => {
  const two = { profiles: [{ id: 'p1', name: 'Anna', menuId: 'autunnale-2026' }, { id: 'p2', name: '', menuId: 'autunnale-2026--no-carne' }], activeId: 'p1' };

  it('REGRESSIONE: il pannello per aggiungere offre standard e tutte le diete, non solo il menu standard', () => {
    const el = settingsView(makeCtx(), true);
    const choices = [...el.querySelectorAll('#add-panel .choice')].map((c) => c.querySelector('.choice-title')?.textContent);
    expect(choices).toContain('Menu standard');
    expect(choices).toContain('Senza latte');
    expect(choices).toContain('Senza carne');
    expect(choices.length).toBeGreaterThanOrEqual(12);
  });
  it('scegliere un menu nel pannello NON aggiunge nulla: serve «Aggiungi»; poi si aggiunge con nome e menu e si torna alle impostazioni', () => {
    const calls: unknown[] = [];
    const went: string[] = [];
    const ctx = { ...makeCtx({ prefs: two }), addProfile: (i: unknown) => calls.push(i), go: (p: string) => went.push(p) };
    let el = settingsView(ctx, true);
    expect(el.querySelector('#add-panel h3')?.textContent).toBe('Nuovo menu');
    const name = el.querySelector<HTMLInputElement>('input[data-fk="add-name"]')!;
    name.value = 'Marco';
    name.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('#add-panel [data-fk="add-choice-autunnale-2026--dieta-1-no-latte"]')!.click(); // sceglie «Senza latte»
    expect(calls).toEqual([]);
    el = settingsView(ctx, true); // il ridisegno conserva nome e scelta
    expect(el.querySelector<HTMLInputElement>('input[data-fk="add-name"]')!.value).toBe('Marco');
    expect(el.querySelector('#add-panel .mf-value')?.textContent).toBe('Senza latte');
    el.querySelector<HTMLButtonElement>('[data-fk="add-confirm"]')!.click();
    expect(calls).toEqual([{ menuId: 'autunnale-2026--dieta-1-no-latte', name: 'Marco' }]);
    expect(went).toEqual(['/settings']);
    expect(settingsView(ctx, true).querySelector<HTMLInputElement>('input[data-fk="add-name"]')!.value).toBe(''); // pannello pulito
  });
  it('ogni bambino ha la sua scheda con nome, menu e azioni dentro; nessuna barra «Cambia menu» a sé', () => {
    const el = settingsView(makeCtx({ prefs: two }));
    const cards = [...el.querySelectorAll('.profile-item')];
    expect(cards).toHaveLength(2);
    for (const c of cards) {
      expect(c.querySelector('input.name-input')).not.toBeNull();
      expect(c.querySelector('.menu-field .mf-label')?.textContent).toBe('Menu');
    }
    expect(cards[0].querySelector('.pname')?.textContent).toBe('Anna');
    expect(cards[0].querySelector('.pill')?.textContent).toBe('In uso');
    expect(cards[1].querySelector('.pname')?.textContent).toBe('Senza carne'); // senza nome: il menu
    expect(cards[1].querySelector('.psub')).toBeNull(); // e non ripetuto
    expect(el.querySelectorAll('.my-menus > summary, .my-menus > .field-label')).toHaveLength(0);
  });
  it('«Rimuovi» solo con più di un bambino; «Usa questo» solo su chi non è in uso', () => {
    const one = settingsView(makeCtx());
    expect(one.querySelector('[data-fk^="pr-"]')).toBeNull();
    const el = settingsView(makeCtx({ prefs: two }));
    expect(el.querySelectorAll('[data-fk^="pr-"]')).toHaveLength(2);
    expect(el.querySelectorAll('[data-fk^="pu-"]')).toHaveLength(1);
  });
  it('si può ripetere la configurazione iniziale', () => {
    let restarted = 0;
    const el = settingsView({ ...makeCtx(), restartWelcome: () => restarted++ });
    el.querySelector<HTMLButtonElement>('[data-fk="welcome-redo"]')!.click();
    expect(restarted).toBe(1);
  });
  it('con il massimo di bambini non si offre di aggiungerne e lo dice', () => {
    const three = { profiles: ids(MAX_PROFILES).map((id) => ({ id, name: '', menuId: 'autunnale-2026' })), activeId: 'p1' };
    const el = settingsView(makeCtx({ prefs: three }), true);
    expect(el.querySelector('#add-panel')).toBeNull();
    expect(el.querySelector('[data-fk="menu-add"]')).toBeNull();
    expect(el.textContent).toContain(`al massimo ${MAX_PROFILES}`);
  });
  it('accessibili (axe) in tutti gli stati', async () => {
    expect(await violations(settingsView(makeCtx({ prefs: two })))).toEqual([]);
    expect(await violations(settingsView(makeCtx({ prefs: two }), true))).toEqual([]);
  });
});

describe('schermata iniziale: elenco dei menu aperto solo dove si lavora', () => {
  const choice = (el: Element, i: number, id: string) => el.querySelector<HTMLButtonElement>(`[data-fk="wl${i}-choice-${id}"]`)!;
  it('il primo bambino ha l\'elenco aperto; scelto un menu si chiude; il bambino aggiunto apre il suo e chiude gli altri', () => {
    const ctx = makeCtx({ prefs: { profiles: [], activeId: null, welcomed: false } });
    let el = welcomeView(ctx, () => {});
    const open = () => [...el.querySelectorAll<HTMLDetailsElement>('.menu-field')].map((d) => d.open);
    expect(open()).toEqual([true]);

    choice(el, 0, 'autunnale-2026--no-carne').click(); // sceglie «Senza carne»
    el = welcomeView(ctx, () => {});
    expect(open()).toEqual([false]);
    expect(el.querySelector('.mf-value')?.textContent).toBe('Senza carne');

    el.querySelector<HTMLButtonElement>('[data-fk="wl-add"]')!.click();
    el = welcomeView(ctx, () => {});
    expect(open()).toEqual([false, true]);
    expect([...el.querySelectorAll('.mf-value')].map((x) => x.textContent)).toEqual(['Senza carne', 'Senza carne']); // parte dal menu dell'ultimo

    choice(el, 1, 'autunnale-2026').click();
    el = welcomeView(ctx, () => {});
    expect(open()).toEqual([false, false]);

    el.querySelector<HTMLButtonElement>('[data-fk="wl-add"]')!.click(); // un terzo: solo il suo elenco è aperto
    el = welcomeView(ctx, () => {});
    expect(open()).toEqual([false, false, true]);
  });
});

describe('ripetere la configurazione iniziale', () => {
  it('parte dai bambini attuali e permette di annullare senza perdere nulla', () => {
    const calls: unknown[] = [];
    const cancelled: number[] = [];
    const ctx = { ...makeCtx({ prefs: { profiles: [{ id: 'p1', name: 'Anna', menuId: 'autunnale-2026' }, { id: 'p2', name: 'Marco', menuId: 'autunnale-2026--no-carne' }], activeId: 'p1', welcomed: false } }), setProfiles: (l: unknown) => calls.push(l) };
    const el = welcomeView(ctx, () => {}, () => cancelled.push(1));
    expect([...el.querySelectorAll<HTMLInputElement>('input.name-input')].map((i) => i.value)).toEqual(['Anna', 'Marco']);
    expect([...el.querySelectorAll('.mf-value')].map((x) => x.textContent)).toEqual(['Menu standard', 'Senza carne']);
    el.querySelector<HTMLButtonElement>('[data-fk="wl-cancel"]')!.click();
    expect(cancelled).toEqual([1]);
    expect(calls).toEqual([]); // niente è cambiato
    expect(welcomeView(ctx, () => {}, () => {}).querySelectorAll('.profile-card')).toHaveLength(2); // bozza ripulita: riparte dai profili attuali
    welcomeView(ctx, () => {}, () => {}).querySelector<HTMLButtonElement>('[data-fk="wl-cancel"]')!.click();
  });
  it('la prima volta (nessun bambino) non c\'è «Annulla»', () => {
    const el = welcomeView(makeCtx({ prefs: { profiles: [], activeId: null, welcomed: false } }), () => {});
    expect(el.querySelector('[data-fk="wl-cancel"]')).toBeNull();
    el.querySelector<HTMLButtonElement>('[data-fk="wl-continue"]')!.click();
  });
});

describe('tutti i menu della famiglia', () => {
  const fam = { profiles: [{ id: 'p1', name: 'Anna', menuId: 'autunnale-2026' }, { id: 'p2', name: '', menuId: 'autunnale-2026--no-carne' }, { id: 'p3', name: 'Bruno', menuId: 'autunnale-2026--dieta-1-no-latte' }], activeId: 'p1' };
  const ctxFam = (over: Parameters<typeof makeCtx>[0] = {}) => makeCtx({ family: true, viewDate: '2026-11-03', ...over, prefs: { ...fam, ...over.prefs } });

  it('è una tabella accessibile: didascalia, intestazioni di colonna (i bambini) e di riga (le portate)', async () => {
    const el = familyView(ctxFam(), '2026-11-03');
    const table = el.querySelector('table')!;
    expect(table.querySelector('caption')?.textContent).toContain('martedì 3 novembre 2026');
    const cols = [...table.querySelectorAll('thead th[scope="col"]')].map((x) => x.textContent);
    expect(cols).toHaveLength(4); // angolo (portata) + 3 bambini
    expect(cols.join('|')).toContain('Anna');
    expect(cols.join('|')).toContain('Senza carne'); // senza nome: il menu
    expect(cols.join('|')).toContain('Bruno');
    const rows = [...table.querySelectorAll('tbody th[scope="row"]')].map((x) => x.textContent);
    expect(rows[0]).toContain('Primo');
    expect(el.querySelector('.family-scroll')?.getAttribute('role')).toBe('region');
    expect(el.querySelector('.family-scroll')?.getAttribute('tabindex')).toBe('0');
    expect(await violations(el)).toEqual([]);
  });
  it('le portate diverse sono segnate anche a parole, e c\'è il riepilogo', () => {
    const el = familyView(ctxFam(), '2026-11-03');
    const differing = [...el.querySelectorAll('tbody tr.differs')];
    expect(differing.length).toBeGreaterThan(0);
    for (const r of differing) expect(r.querySelector('th')?.textContent).toContain('diverso');
    expect(el.querySelector('.family-bar [role="status"]')?.textContent).toMatch(/(\d+ portate su \d+ sono diverse|1 portata su \d+ è diversa)/);
    expect(familyView(ctxFam(), '2026-11-03').textContent).toContain('1 portata su 5 è diversa'); // un solo piatto diverso: singolare
  });
  it('«Solo le differenze» nasconde le portate uguali', () => {
    const all = familyView(ctxFam(), '2026-11-03').querySelectorAll('tbody tr').length;
    const only = familyView(ctxFam({ prefs: { familyDiffOnly: true } }), '2026-11-03');
    const shown = only.querySelectorAll('tbody tr');
    expect(shown.length).toBeLessThan(all);
    expect([...shown].every((r) => r.classList.contains('differs'))).toBe(true);
    expect((only.querySelector('[data-fk="fam-diff"]') as HTMLInputElement).checked).toBe(true);
  });
  it('se i menu sono uguali lo dice e non offre l\'interruttore', () => {
    const same = { profiles: [{ id: 'p1', name: 'Anna', menuId: 'autunnale-2026' }, { id: 'p2', name: 'Marco', menuId: 'autunnale-2026' }], activeId: 'p1' };
    const el = familyView(makeCtx({ family: true, prefs: same }), '2026-11-17');
    expect(el.textContent).toContain('uguali per tutti');
    expect(el.querySelector('[data-fk="fam-diff"]')).toBeNull();
  });
  it('toccare un piatto apre il foglio di quel bambino, con il suo menu', () => {
    const calls: unknown[][] = [];
    const ctx = { ...ctxFam(), openDish: (...a: unknown[]) => calls.push(a) } as unknown as Parameters<typeof familyView>[0];
    const el = familyView(ctx, '2026-11-03');
    const cell = [...el.querySelectorAll<HTMLButtonElement>('.fam-btn')].find((b) => b.textContent?.includes('Pasta olio e parmigiano'))!;
    cell.click();
    expect((calls[0][0] as { text: string }).text).toBe('Pasta olio e parmigiano');
    expect(calls[0][1]).toBe('2026-11-03');
    expect(calls[0][2]).toBe('autunnale-2026--no-carne'); // il menu della colonna, non quello in uso
  });
  it('un piatto variato o eliminato dice cosa è cambiato, come nella pagina del giorno', () => {
    const text = familyView(ctxFam(), '2026-11-10').textContent ?? '';
    expect(text).toContain('variato');
    expect(text).toContain('Invece di: Pasta e ceci');
    expect(text).toContain('Non previsto');
  });
  it('giorno di chiusura: la scheda «niente mensa», senza tabella', async () => {
    const el = familyView(ctxFam(), '2026-11-13');
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('Sciopero del personale');
    expect(await violations(el)).toEqual([]);
  });
  it('i giorni portano alla vista «Tutti» (non alla pagina del singolo bambino)', () => {
    const el = familyView(ctxFam(), '2026-11-03');
    expect([...el.querySelectorAll('.strip a[href]')].every((a) => a.getAttribute('href')!.startsWith('#/family/'))).toBe(true);
  });
});

describe('chip «Tutti» nella riga in cima', () => {
  const two = { profiles: [{ id: 'p1', name: 'Anna', menuId: 'autunnale-2026' }, { id: 'p2', name: 'Marco', menuId: 'autunnale-2026--no-carne' }], activeId: 'p1' };
  it('con 2 o più bambini c\'è; porta alla vista famiglia del giorno che si guardava (o a oggi)', () => {
    const bar = profileBar(makeCtx({ prefs: two, viewDate: '2026-11-10' }))!;
    const all = bar.querySelector('[data-fk="bar-all"]')!;
    expect(all.textContent).toBe('Tutti');
    expect(all.getAttribute('href')).toBe('#/family/2026-11-10');
    expect(profileBar(makeCtx({ prefs: two }))!.querySelector('[data-fk="bar-all"]')!.getAttribute('href')).toBe('#/family');
    expect(all.hasAttribute('aria-current')).toBe(false);
  });
  it('con un solo bambino non c\'è', () => {
    expect(profileBar(makeCtx())!.querySelector('[data-fk="bar-all"]')).toBeNull();
  });
  it('nella vista «Tutti» il chip è quello attivo e nessun bambino risulta «premuto»', () => {
    const bar = profileBar(makeCtx({ prefs: two, family: true, viewDate: '2026-11-10' }))!;
    expect(bar.querySelector('[data-fk="bar-all"]')!.getAttribute('aria-current')).toBe('page');
    expect([...bar.querySelectorAll('button.chip')].map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
  });
  it('accessibile (axe), anche nella vista «Tutti»', async () => {
    expect(await violations(profileBar(makeCtx({ prefs: two, viewDate: '2026-11-10' }))!)).toEqual([]);
    expect(await violations(profileBar(makeCtx({ prefs: two, family: true }))!)).toEqual([]);
  });
});
