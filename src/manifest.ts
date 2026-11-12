// L'icona sulla schermata Home parte da `start_url` del manifest. Lo teniamo uguale all'indirizzo con la scelta dell'utente
// (menu, menu salvati, lingua) sostituendo il <link rel=manifest> con un manifest `data:`: così su iPhone, dove l'app
// installata non condivide il localStorage di Safari, l'icona si apre già sul menu giusto.

interface Base {
  url: string;
  data: Record<string, unknown> & { icons?: { src: string }[] };
}
let base: Base | null = null;
/** L'ultimo manifest scritto: cambiare `href` fa rileggere il manifest al browser, quindi solo se è davvero diverso. */
let lastHref = '';

export async function initManifest(): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return;
  try {
    const res = await fetch(link.href);
    if (res.ok) base = { url: link.href, data: await res.json() };
  } catch {
    /* offline o manifest assente (sviluppo): resta quello statico */
  }
}

/** `search` = `?menu=…&saved=…&lang=…` (con, solo qui, `&names=…` dei profili; o vuoto). */
export function updateManifest(search: string): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link || !base) return;
  const abs = (u: string) => new URL(u, base!.url).href;
  const startUrl = `${location.origin}${location.pathname}${search}`;
  const m = {
    ...base.data,
    id: abs(String(base.data.id ?? base.data.start_url ?? './')),
    scope: abs(String(base.data.scope ?? './')),
    start_url: startUrl,
    icons: (base.data.icons ?? []).map((i) => ({ ...i, src: abs(i.src) })),
  };
  const href = `data:application/manifest+json;charset=utf-8,${encodeURIComponent(JSON.stringify(m))}`;
  if (href === lastHref) return;
  lastHref = href;
  link.href = href;
}
