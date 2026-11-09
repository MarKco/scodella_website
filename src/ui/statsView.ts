import { h } from '../dom';
import { addDays, type ISODate } from '../domain/dates';
import { lastDay } from '../domain/menus';
import { CATEGORIES } from '../domain/types';
import { computeStats, type Counted } from '../domain/stats';
import type { Ctx } from './ctx';

type Period = '7' | '30' | '90' | 'year' | 'all';
const PERIODS: Period[] = ['7', '30', '90', 'year', 'all'];

function range(ctx: Ctx, period: Period): [ISODate, ISODate] {
  const menu = ctx.model.menu;
  const today = ctx.today;
  if (period === '7' || period === '30' || period === '90') return [addDays(today, -(+period - 1)), today];
  if (!menu) return [today, today];
  if (period === 'all') return [menu.validFrom, lastDay(menu)];
  const y = +today.slice(0, 4);
  const startYear = +today.slice(5, 7) >= 9 ? y : y - 1;
  return [`${startYear}-09-01`, `${startYear + 1}-06-30`];
}

const label = (i: Ctx['i18n'], p: Period) => (p === 'year' ? i.t('stats_period_school_year') : p === 'all' ? i.t('stats_period_all') : i.t(`stats_period_${p}`));

function list(title: string, rows: Counted[], max = Math.max(1, ...rows.map((r) => r.count))): HTMLElement | null {
  if (!rows.length) return null;
  return h(
    'section',
    { class: 'card' },
    h('h2', { class: 'card-title' }, title),
    h(
      'ul',
      { class: 'bars' },
      rows.map((r) =>
        h('li', null, h('span', { class: 'bar-label' }, r.label), h('span', { class: 'bar-count' }, String(r.count)), h('span', { class: 'bar', style: { width: `${Math.min(100, Math.max(4, (r.count / max) * 100))}%` } })),
      ),
    ),
  );
}

export function statsView(ctx: Ctx, period: Period = 'year'): HTMLElement {
  const { i18n } = ctx;
  const [from, to] = range(ctx, period);
  const s = computeStats(ctx.model, from, to);
  const root = h('div', { class: 'view stats' }, h('h1', { class: 'page-title' }, i18n.t('nav_stats')), h('p', { class: 'muted' }, i18n.t('stats_hint')));

  root.append(
    h(
      'div',
      { class: 'chips', role: 'group', 'aria-label': i18n.t('stats_period_label') },
      PERIODS.map((p) => h('a', { class: `chip${p === period ? ' on' : ''}`, 'data-fk': `period-${p}`, 'aria-current': p === period ? 'true' : undefined, href: `#/stats/${p}` }, label(i18n, p))),
    ),
  );
  if (s.replaced === 0 && s.deleted === 0) {
    root.append(h('p', { class: 'card notice' }, i18n.t('stats_empty_web')));
    return root;
  }
  root.append(
    h(
      'section',
      { class: 'card summary' },
      h('div', { class: 'big' }, i18n.number(s.replaced)),
      h('div', null, i18n.plural('stats_replaced', s.replaced)),
      h('div', { class: 'muted' }, `${i18n.t('stats_days_label')}: ${i18n.number(s.daysWithChanges)} ${i18n.t('stats_of')} ${i18n.number(s.mensaDays)}`),
      s.deleted > 0 && h('div', { class: 'muted' }, `${i18n.t('stats_deleted_label')}: ${i18n.number(s.deleted)}`),
    ),
  );
  const parts = [
    list(i18n.t('stats_dish_pairs'), s.dishPairs),
    list(i18n.t('stats_most_replaced'), s.mostReplaced),
    list(i18n.t('stats_most_chosen'), s.mostChosen),
    list(
      i18n.t('stats_by_category'),
      CATEGORIES.filter((c) => s.byCategory[c]).map((c) => ({ label: i18n.t(`category_${c.toLowerCase()}`), count: s.byCategory[c]! })),
    ),
    list(
      i18n.t('stats_weekday'),
      s.byWeekday.map((count, i) => ({ label: i18n.weekday(addDays('2026-11-02', i)), count })),
      Math.max(1, ...s.byWeekday),
    ),
  ];
  root.append(h('div', { class: 'cards-grid' }, parts.filter(Boolean) as HTMLElement[]));
  return root;
}
