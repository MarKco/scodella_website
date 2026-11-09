// Port di RemoteVariations / RemoteMoves / RemoteConfigs / RemoteMessages (app Android, `domain/Canteen.kt`, `RemoteConfig.kt`).
import { diffDays, parseISO, type ISODate } from './dates';
import type { Feed, RemoteClosure, RemoteMessage, RemoteMove, RemoteVariation, Texts } from './types';

/** Testo in più lingue: la lingua in uso, poi inglese, poi italiano, poi qualunque. */
export function pickText(texts: Texts | undefined | null, lang: string): string | null {
  if (!texts) return null;
  for (const l of [lang, 'en', 'it']) {
    const t = texts[l];
    if (t && t.trim()) return t;
  }
  return Object.values(texts).find((t) => t && t.trim()) ?? null;
}

export const MAX_CLOSURES = 60;
export const MAX_CLOSURE_DAYS = 31;

export function closureValid(c: RemoteClosure): boolean {
  if (!parseISO(c.from) || !parseISO(c.to)) return false;
  return c.to >= c.from && diffDays(c.from, c.to) < MAX_CLOSURE_DAYS;
}

/** Chiusure comunicate dal comune: funzione accesa, attive, valide. */
export function remoteClosures(feed: Feed): RemoteClosure[] {
  if (feed.config.features?.closures === false) return [];
  return (feed.config.closures ?? []).filter((c) => c.active && closureValid(c)).slice(0, MAX_CLOSURES);
}

export function closureOn(closures: RemoteClosure[], date: ISODate): RemoteClosure | null {
  return closures.find((c) => date >= c.from && date <= c.to) ?? null;
}

/** Spostamenti di giorno da applicare ai menu della stagione: attivi, date valide e diverse; per ogni giorno vince l'ultimo. */
export function effectiveMoves(feed: Feed, season: string | null): Map<ISODate, RemoteMove> {
  const result = new Map<ISODate, RemoteMove>();
  if (feed.config.features?.moves === false) return result;
  for (const m of feed.moves) {
    if (!m.active || m.season !== season) continue;
    if (!parseISO(m.date) || !parseISO(m.fromDate) || m.date === m.fromDate) continue;
    const prev = result.get(m.date);
    if (!prev || m.updatedAt >= prev.updatedAt) result.set(m.date, m);
  }
  return result;
}

export function moveSources(moves: Map<ISODate, RemoteMove>): Map<ISODate, ISODate> {
  return new Map([...moves].map(([date, m]) => [date, m.fromDate]));
}

/** Variazioni da applicare al menu `menuId`: data → (chiave piatto → variazione). Scarta la forma compatibile degli spostamenti in vigore. */
export function effectiveVariations(
  feed: Feed,
  menuId: string | null,
  appliedMoves: Set<string>,
): Map<ISODate, Map<string, RemoteVariation>> {
  const result = new Map<ISODate, Map<string, RemoteVariation>>();
  for (const v of feed.variations) {
    if (!v.active || v.menuId !== menuId) continue;
    if (v.move && appliedMoves.has(v.move)) continue;
    if (!parseISO(v.date) || (v.kind !== 'REPLACE' && v.kind !== 'DELETE')) continue;
    let day = result.get(v.date);
    if (!day) result.set(v.date, (day = new Map()));
    day.set(v.originalKey, v);
  }
  return result;
}

/** Il primo messaggio attivo, nella sua finestra, non ancora chiuso. Ignora i limiti di versione (sono per l'app Android). */
export function pickMessage(
  messages: RemoteMessage[],
  now: number,
  lang: string,
  dismissed: Set<string>,
): { version: string; title: string; body: string } | null {
  const sorted = messages
    .filter((m) => m.active && !dismissed.has(`${m.id}@${m.updatedAt}`))
    .filter((m) => (m.from ?? -Infinity) <= now && now <= (m.to ?? Infinity))
    .sort((a, b) => a.updatedAt - b.updatedAt);
  for (const m of sorted) {
    const body = pickText(m.body, lang);
    if (body) return { version: `${m.id}@${m.updatedAt}`, title: pickText(m.title, lang) ?? '', body };
  }
  return null;
}
