import type { ISODate } from './domain/dates';

export const REPO = 'https://github.com/MarKco/scodella_website';

/** Indirizzo base del sito (con la barra finale), per link assoluti. */
export const siteBase = (): string => `${location.origin}${import.meta.env.BASE_URL}`;

export const calendarUrl = (menuId: string): string => `${siteBase()}calendars/${encodeURIComponent(menuId)}.ics`;
export const webcalUrl = (menuId: string): string => calendarUrl(menuId).replace(/^https?:/, 'webcal:');

/** «Segnala un errore»: apre una issue già compilata con il menu, il giorno e la lingua. */
export function issueUrl(info: { menu: string; date?: ISODate; lang: string }): string {
  const title = `Segnalazione${info.date ? ` del ${info.date}` : ''} · ${info.menu}`;
  const body = [
    `Menu: ${info.menu}`,
    info.date ? `Giorno: ${info.date}` : '',
    `Lingua: ${info.lang}`,
    '',
    'Cosa non torna? (es. un piatto sbagliato, una variazione che manca, una chiusura non indicata…)',
    '',
  ]
    .filter((l, i) => l !== '' || i > 2)
    .join('\n');
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

/** Un indirizzo preso dai dati si usa come link solo se è http(s): mai `javascript:` o simili. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}
