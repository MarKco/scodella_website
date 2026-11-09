// Il sito ridisegna la pagina a ogni cambio di stato: senza queste funzioni il focus finirebbe sul <body> a ogni clic
// (WCAG 2.4.3). I controlli che devono conservare il focus hanno `data-fk="<chiave stabile>"`.

const SAFE = /^[a-z0-9:_.-]+$/i;

/** La chiave del controllo con il focus dentro `root` (o `null`). */
export function focusKey(root: Element, active: Element | null = document.activeElement): string | null {
  if (!active || active === document.body || !root.contains(active)) return null;
  return active.closest('[data-fk]')?.getAttribute('data-fk') ?? null;
}

/** Ridà il focus al controllo con quella chiave, se esiste ancora. */
export function restoreFocus(root: ParentNode, key: string | null): boolean {
  if (!key || !SAFE.test(key)) return false;
  const el = root.querySelector<HTMLElement>(`[data-fk="${key}"]`);
  if (!el) return false;
  el.focus({ preventScroll: true });
  return true;
}
