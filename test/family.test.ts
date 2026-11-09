import { describe, expect, it } from 'vitest';
import { buildFamily, type FamilyColumn } from '../src/domain/family';
import { Model } from '../src/domain/model';
import { EMPTY_PACK } from '../src/domain/types';
import { sampleFeed, data } from './helpers';

const col = (id: string, menuId: string, label = id, feed = sampleFeed): FamilyColumn => ({
  id,
  label,
  menuTitle: '',
  menuId,
  model: new Model(data, feed, EMPTY_PACK, 'it', menuId, '2026-11-10'),
});
const BASE = 'autunnale-2026';
const NO_CARNE = 'autunnale-2026--no-carne';
const NO_LATTE = 'autunnale-2026--dieta-1-no-latte';

describe('buildFamily: i menu di più bambini allineati per portata', () => {
  it('un giorno in cui la dieta cambia un solo piatto: una portata diversa, le altre uguali', () => {
    // martedì 3 novembre, settimana A: nella dieta «senza carne» il primo diventa «Pasta olio e parmigiano»
    const fam = buildFamily([col('a', BASE), col('b', NO_CARNE)], '2026-11-03');
    expect(fam.columns).toHaveLength(2);
    expect(fam.rows.length).toBeGreaterThanOrEqual(5);
    const diff = fam.rows.filter((r) => r.differs);
    expect(diff).toHaveLength(1);
    expect(diff[0].category).toBe('PRIMO');
    expect(diff[0].cells.map((c) => c?.text)).toEqual(['Pasta pasticciata', 'Pasta olio e parmigiano']);
    expect(fam.differentCount).toBe(1);
    // le altre righe: lo stesso piatto per tutti e due
    for (const r of fam.rows.filter((x) => !x.differs)) expect(r.cells[0]?.text).toBe(r.cells[1]?.text);
  });
  it('le righe seguono l\'ordine delle portate e ogni riga ha un piatto per colonna', () => {
    const fam = buildFamily([col('a', BASE), col('b', NO_CARNE), col('c', NO_LATTE)], '2026-11-04');
    const order = ['PRIMO', 'SECONDO', 'CONTORNO', 'PANE', 'FRUTTA', 'DESSERT'];
    const idx = fam.rows.map((r) => order.indexOf(r.category));
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
    for (const r of fam.rows) expect(r.cells).toHaveLength(3);
    expect(new Set(fam.rows.map((r) => r.slot)).size).toBe(fam.rows.length); // nessuna posizione ripetuta
  });
  it('lo stesso menu per due bambini: nessuna differenza', () => {
    const fam = buildFamily([col('a', BASE, 'Anna'), col('b', BASE, 'Marco')], '2026-11-10');
    expect(fam.differentCount).toBe(0);
    expect(fam.rows.every((r) => !r.differs)).toBe(true);
  });
  it('una variazione della mensa vale solo per il menu a cui si riferisce', () => {
    // nel feed di prova il 10 novembre cambia «Pasta e ceci» solo nel menu base
    const fam = buildFamily([col('a', BASE), col('b', NO_CARNE)], '2026-11-10');
    const primo = fam.rows.find((r) => r.category === 'PRIMO')!;
    expect(primo.cells[0]?.replaced).toBe(true);
    expect(primo.cells[0]?.text).toBe('Pasta al pomodoro');
    expect(primo.cells[1]?.replaced).toBe(false);
    expect(primo.differs).toBe(true);
    const eliminato = fam.rows.find((r) => r.cells[0]?.deleted)!;
    expect(eliminato.cells[1]?.deleted).toBe(false);
    expect(eliminato.differs).toBe(true); // «non previsto» non è lo stesso del piatto servito
  });
  it('un giorno senza mensa è uguale per tutti e non ha righe', () => {
    const fam = buildFamily([col('a', BASE), col('b', NO_CARNE)], '2026-11-13'); // sciopero (feed di prova)
    expect(fam.closed?.reason).toBe('Sciopero del personale');
    expect(fam.rows).toEqual([]);
    expect(buildFamily([col('a', BASE)], '2026-12-08').closed?.reason).toBe('Immacolata Concezione');
  });
  it('un fine settimana o un giorno fuori dal menu non ha righe e non si rompe', () => {
    expect(buildFamily([col('a', BASE), col('b', NO_CARNE)], '2026-11-14').rows).toEqual([]); // sabato
    expect(buildFamily([col('a', BASE)], '2026-10-01').rows).toEqual([]); // prima dell'inizio
    expect(buildFamily([], '2026-11-10').rows).toEqual([]);
  });
  it('uno spostamento di giorno si segnala per colonna', () => {
    const fam = buildFamily([col('a', BASE), col('b', NO_CARNE)], '2026-11-12');
    expect(fam.moved.map((m) => m?.from)).toEqual(['2026-11-11', '2026-11-11']);
    expect(buildFamily([col('a', BASE)], '2026-11-10').moved).toEqual([null]);
  });
  it('la posizione del piatto è quella del menu, anche se un piatto sostituito cambia portata', () => {
    const fam = buildFamily([col('a', BASE), col('b', NO_CARNE)], '2026-11-10');
    const slots = fam.rows.map((r) => r.slot).sort();
    expect(slots).toEqual([0, 1, 2, 3, 4]);
  });
});
