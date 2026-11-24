// Nomi tradotti dei menu derivati (vedi `Menu.derived`). Il Comune non li pubblica e le traduzioni dell'app non li conoscono: i testi sono
// del sito (`diet_no_pork_*` in i18n.ts e in public/data/extra/<lingua>.json) e si inseriscono nel pacchetto della lingua prima di costruire i modelli.
import type { LangPack, Menu } from './types';

/** La pagina del Comune che dà la regola del menu «Senza maiale» (menù autunno-inverno). */
export const NO_PORK_SOURCE = 'https://www.comune.venezia.it/it/menuautunnoinverno';

/** `t`: i testi del sito nella lingua in uso. Idempotente: si può riapplicare a un pacchetto già completato. */
export function withDerivedNames(pack: LangPack, menus: Menu[], t: (key: string) => string): LangPack {
  const derived = menus.filter((m) => m.derived);
  if (derived.length === 0) return pack;
  const label = t('diet_no_pork_label');
  const note = t('diet_no_pork_note');
  const named = { ...pack.menus };
  for (const m of derived) {
    const base = menus.find((x) => x.id === m.derived!.base);
    named[m.id] = { ...named[m.id], name: `${(base && pack.menus[base.id]?.name) ?? base?.name ?? m.name} – ${label}`, dietLabel: label, dietNote: note };
  }
  return { ...pack, menus: named };
}
