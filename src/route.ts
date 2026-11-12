import type { ISODate } from './domain/dates';

export type Period = '7' | '30' | '90' | 'year' | 'all';

export type Route =
  | { name: 'day'; date: ISODate; fromToday?: boolean }
  /** «Tutti i menu»: il giorno di ogni bambino affiancato. */
  | { name: 'family'; date: ISODate; fromToday?: boolean }
  | { name: 'calendar'; month: string }
  | { name: 'stats'; period: Period }
  /**
   * `add`: arrivati dal «＋ Aggiungi» della riga in cima: il pannello per aggiungere un menu è già aperto.
   * `calendar`: arrivati da «Aggiungi al calendario» dove `webcal:` non funziona: la sezione Calendario ha già le istruzioni aperte.
   */
  | { name: 'settings'; add?: boolean; calendar?: boolean };

/**
 * La vista è cambiata (altra pagina, o altro giorno): si torna in cima e, se l'utente stava usando un link, il focus passa al titolo.
 * Se invece cambia solo lo stato (un'opzione, un periodo, il mese), scroll e focus restano dove sono.
 */
export function viewChanged(prev: Route | null, next: Route): boolean {
  if (!prev || prev.name !== next.name) return true;
  return (prev.name === 'day' || prev.name === 'family') && prev.name === next.name && 'date' in next && 'date' in prev && prev.date !== next.date;
}
