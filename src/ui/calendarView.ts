import { h } from '../dom';
import { badges } from '../domain/content';
import { addDays, daysInMonth, isoWeekday, type ISODate } from '../domain/dates';
import { effectiveMoves, effectiveVariations } from '../domain/feed';
import type { Ctx } from './ctx';
import { kindEmoji } from './kinds';
import { icon } from './icons';

const pad = (n: number) => String(n).padStart(2, '0');

const shiftMonth = (month: string, by: number): string => {
  const d = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

interface GridOptions {
  /** Giorno da evidenziare (nel mini calendario del giorno). */
  selected?: ISODate;
  /** Mostra primo e secondo piatto nelle celle (solo schermi larghi: lo decide il CSS). */
  dishes?: boolean;
  compact?: boolean;
}

/**
 * Un mese (`AAAA-MM`) come tabella: intestazioni dei giorni, una riga per settimana, una cella per giorno. Le celle con menu contengono un
 * link; il nome di ogni cella è «martedì, 3 novembre 2026» più, a parole, ciò che di solito si capisce solo dai colori (chiusura, variazione, oggi).
 */
export function monthGrid(ctx: Ctx, month: string, opts: GridOptions = {}): HTMLElement {
  const { i18n, model } = ctx;
  const year = +month.slice(0, 4);
  const m0 = +month.slice(5, 7) - 1;
  const first: ISODate = `${year}-${pad(m0 + 1)}-01`;
  const total = daysInMonth(year, m0);
  const monthName = i18n.month(year, m0);

  const menu = model.menu;
  const applied = menu ? new Set([...effectiveMoves(model.feed, menu.season).values()].map((x) => x.id)) : new Set<string>();
  const changed = menu ? effectiveVariations(model.feed, menu.id, applied) : new Map();

  // Intestazione dei giorni: lunedì 2026-11-02 + i.
  const heads = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = addDays('2026-11-02', i);
    return h('th', { class: 'cal-head', scope: 'col', abbr: i18n.weekday(d) }, i18n.weekday(d, opts.compact ? 'narrow' : 'short'));
  });

  const cells: HTMLElement[] = [];
  for (let i = 0; i < isoWeekday(first) - 1; i++) cells.push(h('td', { class: 'cal-td' }));
  for (let day = 1; day <= total; day++) {
    const d: ISODate = `${year}-${pad(m0 + 1)}-${pad(day)}`;
    const weekend = isoWeekday(d) >= 6;
    const closure = model.closure(d);
    const content = model.content(d);
    const hasChange = (changed.get(d)?.size ?? 0) > 0 && !!content && content.entries.some((e) => e.replaced || e.deleted);
    const kind = content ? badges(content.entries)[0] : undefined;
    const names = content && opts.dishes ? content.entries.filter((e) => e.category === 'PRIMO' || e.category === 'SECONDO').slice(0, 2) : [];
    const cls = ['cal-cell', weekend && 'weekend', closure && !weekend && 'closed', d === ctx.today && 'today', d === opts.selected && 'on']
      .filter(Boolean)
      .join(' ');
    const inner = [
      h('span', { class: 'sr-only' }, `${i18n.weekday(d)}, `),
      h('span', { class: 'cal-num' }, String(day)),
      h('span', { class: 'sr-only' }, ` ${monthName}`),
      d === ctx.today && h('span', { class: 'sr-only' }, ` · ${i18n.t('today')}`),
      closure && !weekend && h('span', { class: 'sr-only' }, ` · ${i18n.t('calendar_closed')}`),
      hasChange && h('span', { class: 'sr-only' }, ` · ${i18n.t('calendar_variation')}`),
      kind && h('span', { class: 'cal-kind', 'aria-hidden': 'true' }, kindEmoji(kind)),
      hasChange && h('span', { class: 'cal-dot', 'aria-hidden': 'true' }),
      names.length > 0 && h('span', { class: 'cal-dishes' }, names.map((e) => h('span', { class: `cal-dish${e.replaced ? ' replaced' : ''}` }, e.deleted ? e.original : e.text))),
    ];
    cells.push(
      h(
        'td',
        { class: 'cal-td' },
        content ? h('a', { class: `${cls} has-menu`, href: `#/${d}`, 'aria-current': d === opts.selected ? 'page' : undefined }, inner) : h('div', { class: cls }, inner),
      ),
    );
  }
  while (cells.length % 7 !== 0) cells.push(h('td', { class: 'cal-td' }));
  const rows: HTMLElement[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(h('tr', null, cells.slice(i, i + 7)));

  return h(
    'table',
    { class: `cal-grid${opts.compact ? ' compact' : ''}` },
    h('caption', { class: 'sr-only' }, monthName),
    h('thead', null, h('tr', null, heads)),
    h('tbody', null, rows),
  );
}

/** `month` = `AAAA-MM`. */
export function calendarView(ctx: Ctx, month: string): HTMLElement {
  const { i18n } = ctx;
  const year = +month.slice(0, 4);
  const m0 = +month.slice(5, 7) - 1;
  return h(
    'div',
    { class: 'view calendar' },
    h(
      'div',
      { class: 'month-bar' },
      h('a', { class: 'icon-btn', 'data-fk': 'month-prev', href: `#/calendar/${shiftMonth(month, -1)}`, 'aria-label': i18n.t('prev_month') }, icon('prev')),
      h('h1', { class: 'month-title' }, i18n.month(year, m0)),
      h('a', { class: 'icon-btn', 'data-fk': 'month-next', href: `#/calendar/${shiftMonth(month, 1)}`, 'aria-label': i18n.t('next_month') }, icon('next')),
    ),
    monthGrid(ctx, month, { dishes: true }),
    h(
      'div',
      { class: 'legend' },
      h('span', null, h('i', { class: 'cal-dot' }), i18n.t('legend_changed')),
      h('span', null, h('i', { class: 'swatch closed' }), i18n.t('legend_closed')),
    ),
    h('a', { class: 'btn tonal', 'data-fk': 'month-today', href: `#/calendar/${ctx.today.slice(0, 7)}` }, i18n.t('today')),
  );
}

/** Mini calendario del giorno (desktop): le frecce cambiano mese senza lasciare la pagina. */
export function miniMonth(ctx: Ctx, selected: ISODate): HTMLElement {
  const { i18n } = ctx;
  let month = selected.slice(0, 7);
  const title = h('h2', { class: 'mini-title' });
  const holder = h('div', { class: 'mini-grid' });
  const draw = () => {
    title.textContent = i18n.month(+month.slice(0, 4), +month.slice(5, 7) - 1);
    holder.replaceChildren(monthGrid(ctx, month, { selected, compact: true }));
  };
  const nav = (by: number, label: string, name: 'prev' | 'next') =>
    h('button', { class: 'icon-btn small', 'data-fk': `mini-${name}`, 'aria-label': label, onclick: () => ((month = shiftMonth(month, by)), draw()) }, icon(name, 20));
  draw();
  return h(
    'section',
    { class: 'card mini-month', 'aria-label': i18n.t('month_nav') },
    h('div', { class: 'mini-bar' }, nav(-1, i18n.t('prev_month'), 'prev'), title, nav(1, i18n.t('next_month'), 'next')),
    holder,
  );
}
