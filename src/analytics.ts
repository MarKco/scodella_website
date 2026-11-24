// Contatore di visite GoatCounter (anonimo, senza cookie: vedi `#/privacy`). Lo script c'è solo nella build (vite.config.ts).
import { LANGS } from './i18n';

interface GoatCounter {
  count(data: { path: string; title: string }): void;
  get_data(vars?: object): Record<string, unknown>;
}
const goatcounter = (): GoatCounter | undefined => (window as unknown as { goatcounter?: GoatCounter }).goatcounter;

/**
 * Una visita, come pagina «/<lingua>» (es. «/hi»): è l'unico dato oltre a quelli tecnici del browser, e permette di sapere in che lingua
 * si usa il sito; mai il giorno, il menu né i nomi dei bambini. Lo script aggiunge da solo la parte `?…` dell'indirizzo (`q`), che
 * contiene menu e lingua (e, all'avvio dall'icona Home, i nomi): qui la si svuota prima di inviare. Con il segnale «Do Not Track»
 * non invia nulla. La lingua è quella con cui si apre il sito: un cambio fatto dopo non conta una seconda visita.
 */
export function countVisit(lang: string): void {
  if (navigator.doNotTrack === '1' || !LANGS.some((l) => l.code === lang)) return;
  const script = document.querySelector<HTMLScriptElement>('script[data-goatcounter]');
  if (!script) return;
  const send = () => {
    const gc = goatcounter();
    if (!gc?.count) return;
    const original = gc.get_data.bind(gc);
    gc.get_data = (vars) => ({ ...original(vars), q: '' });
    gc.count({ path: `/${lang}`, title: 'Scodella' });
  };
  if (goatcounter()?.count) send();
  else script.addEventListener('load', send, { once: true });
}
