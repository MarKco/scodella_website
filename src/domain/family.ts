// «Tutti i menu della famiglia»: il giorno di ogni bambino affiancato, una riga per portata. I menu di una stagione (standard e diete)
// hanno la stessa griglia di piatti e le diete cambiano solo alcune posizioni: si allineano per posizione (`slot`), quindi le righe
// corrispondono sempre e si vede subito dove i menu divergono. Logica pura, testata.
import { CATEGORIES, type Category } from './types';
import type { DishEntry, MovedDay } from './content';
import type { ISODate } from './dates';
import type { ClosedDay, Model } from './model';

export interface FamilyColumn {
  id: string;
  /** Il nome del bambino o, senza nome, quello del menu. */
  label: string;
  /** Il nome del menu, solo se la colonna ha un nome (altrimenti sarebbe una ripetizione). */
  menuTitle: string;
  menuId: string;
  model: Model;
}

export interface FamilyRow {
  slot: number;
  category: Category;
  /** Un piatto per colonna; `null` se quel menu non ha niente in quella posizione. */
  cells: (DishEntry | null)[];
  /** I bambini non hanno lo stesso piatto in questa portata. */
  differs: boolean;
}

export interface FamilyDay {
  date: ISODate;
  columns: FamilyColumn[];
  rows: FamilyRow[];
  /** Giorno senza mensa (uguale per tutti i menu). */
  closed: ClosedDay | null;
  /** Per colonna: lo spostamento di giorno, se c'è. */
  moved: (MovedDay | null)[];
  differentCount: number;
}

/** Ciò che si vede: due celle uguali = stesso piatto servito (un piatto eliminato è un'altra cosa dal piatto che lo sostituisce). */
const signature = (e: DishEntry | null): string => (e ? `${e.deleted ? 'x' : 't'}:${e.text}` : '-');

export function buildFamily(columns: FamilyColumn[], date: ISODate): FamilyDay {
  const closed = columns[0]?.model.closure(date) ?? null;
  const contents = columns.map((c) => c.model.content(date));
  const slots = Math.max(0, ...contents.map((c) => (c ? Math.max(-1, ...c.entries.map((e) => e.slot)) + 1 : 0)));

  const rows: FamilyRow[] = [];
  for (let slot = 0; slot < slots; slot++) {
    const cells = contents.map((c) => c?.entries.find((e) => e.slot === slot) ?? null);
    const first = cells.find((x) => x);
    if (!first) continue;
    rows.push({ slot, category: first.baseCategory, cells, differs: new Set(cells.map(signature)).size > 1 });
  }
  // Per portata (come nella pagina del giorno), a pari portata nell'ordine del menu.
  rows.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.slot - b.slot);

  return {
    date,
    columns,
    rows: closed ? [] : rows,
    closed,
    moved: contents.map((c) => c?.moved ?? null),
    differentCount: rows.filter((r) => r.differs).length,
  };
}
