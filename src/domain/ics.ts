// Calendario in abbonamento (iCalendar, RFC 5545) di un menu: un evento «tutto il giorno» per ogni giorno di mensa, con i piatti,
// le variazioni e le chiusure. Si genera al build dall'Action (scripts/build-calendars.ts) e si pubblica come file statico;
// chi si abbona lo rilegge da solo. Logica pura: gli stessi `Model` e feed del sito, quindi nessuna regola duplicata.
import { addDays, isWeekend, type ISODate } from './dates';
import type { DishEntry } from './content';
import { lastDay } from './menus';
import type { Model } from './model';
import type { Feed } from './types';

export interface CalendarOptions {
  /** `Model` costruito per il menu da pubblicare (`model.menu`). */
  model: Model;
  /** Indirizzo base del sito, con la barra finale. */
  baseUrl: string;
  /** Dominio per gli UID (`<menu>-<data>@dominio`). */
  uidDomain: string;
  /** Istante di generazione (ms) usato come DTSTAMP quando il feed non ne ha uno. */
  now?: number;
}

const CRLF = '\r\n';

/** Testo iCalendar: escape di `\` `;` `,` e a capo. */
export const escapeText = (s: string): string =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    // niente altri caratteri di controllo (un \r isolato o un NUL spezzerebbero la riga o il file)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

/** Piega una riga a 75 ottetti UTF-8 (le continuazioni cominciano con uno spazio), senza spezzare un carattere. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // lo spazio iniziale conta
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join(`${CRLF} `);
}

const utc = (ms: number): string => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const compact = (d: ISODate): string => d.replace(/-/g, '');

/** Per ogni giorno, l'ultimo `updatedAt` (ms) di ciò che lo riguarda nel feed: variazioni (anche ritirate), spostamenti, chiusure. */
export function relatedStamps(feed: Feed, menuId: string, season: string, from: ISODate, to: ISODate): Map<ISODate, number> {
  const stamps = new Map<ISODate, number>();
  const bump = (d: ISODate, t: number) => {
    if (t > (stamps.get(d) ?? 0)) stamps.set(d, t);
  };
  for (const v of feed.variations) if (v.menuId === menuId) bump(v.date, v.updatedAt);
  for (const m of feed.moves) if (m.season === season) bump(m.date, m.updatedAt);
  for (const c of feed.config.closures ?? []) {
    if (c.to < c.from) continue;
    for (let d = c.from < from ? from : c.from, end = c.to > to ? to : c.to, i = 0; d <= end && i < 62; d = addDays(d, 1), i++) bump(d, c.updatedAt);
  }
  return stamps;
}

const variedEntries = (entries: DishEntry[]) => entries.filter((e) => e.replaced || e.deleted);

/** «Primo · Secondo» (i piatti serviti, senza gli eliminati). */
function headline(entries: DishEntry[]): string {
  const served = entries.filter((e) => !e.deleted);
  const pick = (c: string) => served.find((e) => e.category === c)?.text;
  const names = [pick('PRIMO'), pick('SECONDO')].filter((x): x is string => !!x);
  return (names.length ? names : served.slice(0, 2).map((e) => e.text)).join(' · ');
}

export function buildCalendar(opts: CalendarOptions): string {
  const { model, baseUrl, uidDomain } = opts;
  const menu = model.menu;
  if (!menu) throw new Error('nessun menu per il calendario');
  const feed = model.feed;
  const end = lastDay(menu);
  const stamps = relatedStamps(feed, menu.id, menu.season, menu.validFrom, end);
  const dtstamp = utc(feed.updatedAt || opts.now || 0);
  const title = model.names.menuTitle(menu);
  const lines: string[] = [];
  const add = (l: string) => lines.push(fold(l));

  add('BEGIN:VCALENDAR');
  add('VERSION:2.0');
  add('PRODID:-//Scodella//menu-mense-venezia//IT');
  add('CALSCALE:GREGORIAN');
  add('METHOD:PUBLISH');
  add(`X-WR-CALNAME:${escapeText(`Scodella · ${title}`)}`);
  add(`X-WR-CALDESC:${escapeText(`Menu della mensa scolastica (${title}), Comune di Venezia. Sito non ufficiale: fa fede il menu del Comune.`)}`);
  add('X-WR-TIMEZONE:Europe/Rome');
  add('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
  add('X-PUBLISHED-TTL:PT1H');

  for (let d = menu.validFrom; d <= end; d = addDays(d, 1)) {
    if (isWeekend(d)) continue;
    const closure = model.closure(d);
    const content = closure ? null : model.content(d);
    if (!closure && !content) continue;

    const related = stamps.get(d) ?? 0;
    const link = `${baseUrl}?menu=${encodeURIComponent(menu.id)}#/${d}`;
    const varied = content ? variedEntries(content.entries) : [];
    const flagged = varied.length > 0 || !!content?.moved;

    let summary: string;
    const desc: string[] = [];
    if (closure) {
      summary = `🚫 Niente mensa${closure.reason ? ` · ${closure.reason}` : ''}`;
      desc.push(closure.reason || 'Niente mensa');
    } else {
      const c = content!;
      summary = flagged ? `⚠️ VARIATO · ${headline(c.entries)}` : `🍽 ${headline(c.entries)}`;
      for (const e of c.entries) {
        if (e.deleted) desc.push(`• ${e.original} (non previsto)`);
        else if (e.replaced) desc.push(`• ${e.text} (al posto di ${e.original})`);
        else desc.push(`• ${e.text}`);
      }
      desc.push('', `Settimana ${c.day.week} · ${model.names.menu(menu)}`);
      if (c.moved) desc.push(`Si serve il menu di ${c.moved.from}${c.moved.note ? `: ${c.moved.note}` : ''} (spostamento comunicato dalla mensa).`);
    }
    desc.push('', `Tutto il menu: ${link}`);

    add('BEGIN:VEVENT');
    add(`UID:${menu.id}-${compact(d)}@${uidDomain}`);
    add(`DTSTAMP:${dtstamp}`);
    add(`LAST-MODIFIED:${related ? utc(related) : dtstamp}`);
    // Sale ogni volta che cambia qualcosa che riguarda il giorno (anche un ritiro): i client rileggono l'evento.
    add(`SEQUENCE:${Math.floor(related / 1000)}`);
    add(`DTSTART;VALUE=DATE:${compact(d)}`);
    add(`DTEND;VALUE=DATE:${compact(addDays(d, 1))}`);
    add(`SUMMARY:${escapeText(summary)}`);
    add(`DESCRIPTION:${escapeText(desc.join('\n'))}`);
    add(`URL:${link}`);
    add('TRANSP:TRANSPARENT');
    add('STATUS:CONFIRMED');
    if (flagged) {
      // Avviso alle 7:00 nei giorni variati (per chi tiene attivi gli avvisi del calendario).
      add('BEGIN:VALARM');
      add('ACTION:DISPLAY');
      add(`DESCRIPTION:${escapeText(summary)}`);
      add('TRIGGER;RELATED=START:PT7H');
      add('END:VALARM');
    }
    add('END:VEVENT');
  }
  add('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}
