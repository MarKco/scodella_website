// La scelta dell'utente (menu, profili, lingua) vive anche nell'indirizzo: l'icona sulla schermata Home di iPhone non vede il
// localStorage di Safari, ma parte dall'indirizzo che il manifest le dà (vedi manifest.ts). Funzioni pure, testate.
//
// PRIVACY: i nomi dei bambini non entrano MAI nell'indirizzo visibile né nei link da condividere. Esiste un solo parametro `names`,
// scritto soltanto nello `start_url` del manifest (che resta sul dispositivo), letto una volta all'avvio e subito tolto dall'indirizzo.
import { cleanName, MAX_PROFILES } from './prefs';

export interface UrlState {
  /** Menu attivo. */
  menu?: string;
  /** Un menu per profilo, nell'ordine (lo stesso menu può comparire più volte). */
  saved: string[];
  /** Indice (da 0) del profilo attivo dentro `saved`. */
  active?: number;
  lang?: string;
  /** Nomi dei profili, solo dallo `start_url` del manifest. */
  names: string[];
}

const SEP = '|';
const ID = /^[a-z0-9][a-z0-9-]*$/i;

export function parseState(search: string): UrlState {
  const p = new URLSearchParams(search);
  const clean = (s: string | null) => (s && ID.test(s) ? s : undefined);
  const saved = (p.get('saved') ?? '')
    .split(SEP)
    .map((s) => clean(s))
    .filter((s): s is string => !!s)
    .slice(0, MAX_PROFILES);
  const menu = clean(p.get('menu'));
  const n = Number(p.get('p'));
  // Prima versione degli indirizzi: niente `p`, il profilo attivo è il primo con quel menu.
  const byIndex = Number.isInteger(n) && n >= 1 && n <= saved.length ? n - 1 : undefined;
  const active = byIndex ?? (menu ? saved.indexOf(menu) : -1);
  const rawNames = p.get('names');
  const names = rawNames ? rawNames.split(SEP).slice(0, MAX_PROFILES).map(cleanName) : [];
  return { menu, saved, active: active >= 0 ? active : undefined, lang: clean(p.get('lang')), names };
}

/**
 * Riscrive `menu`, `saved`, `p` e `lang` dentro `search` lasciando intatti gli altri parametri (es. `oggi`) e **togliendo sempre `names`**.
 * Restituisce `?…` o ''.
 */
export function applyState(search: string, s: { menu?: string | null; saved?: string[]; active?: number; lang?: string | null }): string {
  const p = new URLSearchParams(search);
  const set = (k: string, v: string | null | undefined) => (v ? p.set(k, v) : p.delete(k));
  const many = !!s.saved && s.saved.length > 1;
  set('menu', s.menu);
  set('saved', many ? s.saved!.join(SEP) : null);
  set('p', many && s.active !== undefined ? String(s.active + 1) : null);
  set('lang', s.lang);
  p.delete('names');
  const q = p.toString().replace(/%7C/g, SEP);
  return q ? `?${q}` : '';
}

/** Lo `search` per lo `start_url` del manifest: quello di `applyState` più i nomi, se ce n'è almeno uno. Mai usato per link condivisibili. */
export function startSearch(search: string, names: string[]): string {
  if (!names.some((n) => n)) return search;
  const p = new URLSearchParams(search);
  p.set('names', names.map(cleanName).join(SEP));
  return `?${p.toString().replace(/%7C/g, SEP)}`;
}
