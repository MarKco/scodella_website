// Contatore di visite GoatCounter (anonimo, senza cookie: vedi `#/privacy`). Lo script c'è solo nella build (vite.config.ts).

interface GoatCounter {
  count(data: { path: string; title: string }): void;
  get_data(vars?: object): Record<string, unknown>;
}
const goatcounter = (): GoatCounter | undefined => (window as unknown as { goatcounter?: GoatCounter }).goatcounter;

/**
 * Una visita, sempre come pagina «/»: mai il giorno, il menu, la lingua né i nomi dei bambini. Lo script aggiunge da solo la parte `?…`
 * dell'indirizzo (`q`), che contiene menu e lingua (e, all'avvio dall'icona Home, i nomi): qui la si svuota prima di inviare.
 * Con il segnale «Do Not Track» non invia nulla.
 */
export function countVisit(): void {
  if (navigator.doNotTrack === '1') return;
  const script = document.querySelector<HTMLScriptElement>('script[data-goatcounter]');
  if (!script) return;
  const send = () => {
    const gc = goatcounter();
    if (!gc?.count) return;
    const original = gc.get_data.bind(gc);
    gc.get_data = (vars) => ({ ...original(vars), q: '' });
    gc.count({ path: '/', title: 'Scodella' });
  };
  if (goatcounter()?.count) send();
  else script.addEventListener('load', send, { once: true });
}
