import { h } from '../dom';
import { badges, FOODS, type DishEntry, type Food } from '../domain/content';
import { addDays, isWeekend, mondayOf, toISO, type ISODate } from '../domain/dates';
import type { DishKind } from '../domain/types';
import { lastDay } from '../domain/menus';
import { webcalUrl } from '../links';
import { opensWebcal } from '../platform';
import type { Ctx } from './ctx';
import { icon } from './icons';
import { pill } from './components';
import { miniMonth } from './calendarView';

/** Il giorno ha piatti variati o eliminati dalla mensa, oppure è uno spostamento. */
function isVaried(ctx: Ctx, d: ISODate): boolean {
  const c = ctx.model.content(d);
  return !!c && (!!c.moved || c.entries.some((e) => e.replaced || e.deleted));
}

/** Perché `date` non ha mensa, in poche parole (per l'avviso «oggi niente mensa»). */
function whyNoCanteen(ctx: Ctx, date: ISODate): string {
  const { i18n, model } = ctx;
  const closure = model.closure(date);
  if (closure) return closure.reason || i18n.t('closure_reason_default');
  if (isWeekend(date)) return i18n.t('reason_weekend');
  const menu = model.menu;
  if (menu && date < menu.validFrom) return i18n.t('reason_not_started');
  if (menu && date > lastDay(menu)) return i18n.t('reason_ended');
  return i18n.t('reason_generic');
}

const longDay = (ctx: Ctx, d: ISODate) => `${ctx.i18n.weekday(d)} ${ctx.i18n.dateShort(d)}`;

/** «Oggi, sabato 14 nov: niente mensa (fine settimana). Ecco lunedì 16 nov.» — solo se si entra senza data e oggi non c'è mensa. */
export function todayNotice(ctx: Ctx, today: ISODate, shown: ISODate): HTMLElement {
  return h('section', { class: 'card notice-soft', role: 'note' }, ctx.i18n.t('today_closed', longDay(ctx, today), whyNoCanteen(ctx, today), longDay(ctx, shown)));
}

function header(ctx: Ctx, date: ISODate): HTMLElement {
  const { i18n, model } = ctx;
  const content = model.content(date);
  const week = content?.day.week;
  const kinds = content ? badges(content.entries) : [];
  const varied = content ? content.entries.filter((e) => e.replaced || e.deleted).length : 0;
  return h(
    'header',
    { class: 'day-head' },
    h('h1', { class: 'day-title' }, i18n.weekday(date)),
    h(
      'div',
      { class: 'day-sub' },
      h('span', { class: 'day-date' }, i18n.dateLong(date)),
      date === ctx.today && pill(i18n.t('today'), 'pill-primary'),
      week && pill(i18n.t('week_label', week)),
      varied > 0 && pill(varied === 1 ? i18n.t('varied_one') : i18n.t('varied_many', varied), 'pill-alert'),
      kinds.map((k) => pill(i18n.t(`kind_${k.toLowerCase()}`), 'pill-kind')),
    ),
  );
}

/** Striscia lun–ven della settimana del giorno mostrato. */
/** `base`: dove portano i giorni (`''` = pagina del giorno, `'/family'` = «Tutti i menu»). */
export function strip(ctx: Ctx, date: ISODate, base = ''): HTMLElement {
  const { i18n, model } = ctx;
  const monday = mondayOf(date);
  return h(
    'nav',
    { class: 'strip', 'aria-label': i18n.t('nav_day') },
    [0, 1, 2, 3, 4].map((i) => {
      const d = addDays(monday, i);
      const closed = model.closure(d) !== null;
      return h(
        'a',
        {
          class: `strip-day${d === date ? ' on' : ''}${closed ? ' closed' : ''}${d === ctx.today ? ' today' : ''}${isVaried(ctx, d) ? ' varied' : ''}`,
          href: closed ? undefined : `#${base}/${d}`,
          'aria-current': d === date ? 'date' : undefined,
          'aria-disabled': closed ? 'true' : undefined,
        },
        h('span', { class: 'strip-wd' }, i18n.weekday(d, 'short')),
        h('span', { class: 'strip-num' }, String(+d.slice(8))),
        closed && h('span', { class: 'sr-only' }, ` ${i18n.t('calendar_closed')}`),
        !closed && isVaried(ctx, d) && h('span', { class: 'sr-only' }, ` ${i18n.t('calendar_variation')}`),
      );
    }),
  );
}

export function controls(ctx: Ctx, date: ISODate, base = ''): HTMLElement {
  const { i18n, model } = ctx;
  const input = h('input', {
    type: 'date',
    class: 'date-input',
    'data-fk': 'day-date',
    value: date,
    'aria-label': i18n.t('pick_date'),
    onchange: (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      if (v) ctx.go(`${base}/${model.onOrAfter(v)}`);
    },
  });
  return h(
    'div',
    { class: 'controls' },
    h('button', { class: 'icon-btn', 'data-fk': 'day-prev', 'aria-label': i18n.t('prev_day'), onclick: () => ctx.go(`${base}/${model.step(date, -1)}`) }, icon('prev')),
    h('label', { class: 'date-pick' }, h('span', { class: 'sr-only' }, i18n.t('pick_date')), input),
    date !== ctx.today && h('button', { class: 'btn tonal', 'data-fk': 'day-today', onclick: () => ctx.go(`${base}/${model.onOrAfter(ctx.today)}`) }, i18n.t('today')),
    h('button', { class: 'icon-btn', 'data-fk': 'day-next', 'aria-label': i18n.t('next_day'), onclick: () => ctx.go(`${base}/${model.step(date, 1)}`) }, icon('next')),
  );
}

/** Icona accanto al piatto: solo carne, pesce, affettati e vegano (il resto, vegetariano compreso, non ne ha). */
const DISH_ICON: Partial<Record<DishKind, string>> = { MEAT: '🍗', FISH: '🐟', COLD_CUTS: '🥓', VEGAN: '🌱' };

function dishRow(ctx: Ctx, e: DishEntry, date: ISODate): HTMLElement {
  const { i18n } = ctx;
  const kind = e.kind && !e.deleted && DISH_ICON[e.kind] ? e.kind : null;
  const main = h(
    'div',
    { class: 'dish-main' },
    h('div', { class: 'overline' }, i18n.t(`category_${e.category.toLowerCase()}`), (e.replaced || e.deleted) && h('span', { class: 'tag-varied' }, i18n.t('varied_tag'))),
    h('div', { class: `dish-name${e.deleted ? ' struck' : ''}` }, e.deleted ? e.original : e.text),
    e.replaced && h('div', { class: 'dish-sub' }, i18n.t('dish_replaced_original', ''), h('s', null, e.original)),
    e.deleted && h('div', { class: 'dish-sub strong' }, i18n.t('dish_deleted')),
    e.note && !e.deleted && h('div', { class: 'dish-note' }, e.note),
  );
  return h(
    'li',
    { class: `dish${e.replaced ? ' replaced' : ''}${e.deleted ? ' deleted' : ''}` },
    h(
      'button',
      { class: 'dish-btn', onclick: () => ctx.openDish(e, date) },
      main,
      kind && h('div', { class: 'dish-kind', 'aria-hidden': 'true' }, DISH_ICON[kind]),
      // L'icona è solo visiva: lo stesso dato, a parole, per chi non la vede.
      kind && h('span', { class: 'sr-only' }, `. ${i18n.t(`kind_${kind.toLowerCase()}`)}`),
    ),
  );
}

function streakLine(ctx: Ctx, food: Food, date: ISODate): HTMLElement | null {
  const { i18n } = ctx;
  const info = ctx.model.streak(date, food);
  if (!info) return null;
  const p = food.toLowerCase().replace('eggs', 'egg');
  if (info.today) return h('p', { class: 'streak' }, i18n.t(`${p}_today`));
  const last = info.daysSinceLast == null ? i18n.t(`${p}_last_none`) : i18n.t(`${p}_last`, i18n.plural('streak_ago', info.daysSinceLast));
  const next = info.daysUntilNext == null ? i18n.t(`${p}_next_none`) : i18n.t(`${p}_next`, i18n.plural('streak_in', info.daysUntilNext));
  return h('p', { class: 'streak' }, `${last} · ${next}`);
}

export function closedCard(ctx: Ctx, date: ISODate): HTMLElement {
  const { i18n } = ctx;
  const c = ctx.model.closure(date)!;
  return h(
    'section',
    { class: 'card notice' },
    h('h2', { class: 'card-title' }, i18n.t('closure_title')),
    h('p', null, c.reason || i18n.t('closure_reason_default')),
    c.from !== c.to && h('p', { class: 'muted' }, i18n.t('closure_range', i18n.dateLong(c.from), i18n.dateLong(c.to))),
  );
}

function unavailableCard(ctx: Ctx, date: ISODate): HTMLElement {
  const { i18n, model } = ctx;
  const menu = model.menu;
  let text = i18n.t('menu_none');
  if (menu) {
    const name = model.names.menuTitle(menu);
    if (date < menu.validFrom) text = i18n.t('menu_unavailable_from', name, i18n.dateLong(menu.validFrom));
    else if (date > lastDay(menu)) text = i18n.t('menu_unavailable_until', name, i18n.dateLong(lastDay(menu)));
    else text = i18n.t('menu_unavailable_generic', name);
  }
  return h(
    'section',
    { class: 'card notice' },
    h('h2', { class: 'card-title' }, i18n.t('menu_unavailable_title')),
    h('p', null, text),
    h('a', { class: 'btn tonal', href: '#/settings' }, i18n.t('change_menu')),
  );
}

/** «La settimana» (desktop): i 5 giorni affiancati, per vedere tutto subito. Su telefono è nascosta (c'è la striscia). */
function weekOverview(ctx: Ctx, date: ISODate): HTMLElement {
  const { i18n, model } = ctx;
  const monday = mondayOf(date);
  const card = (d: ISODate) => {
    const content = model.content(d);
    const closure = model.closure(d);
    const shown = content ? content.entries : [];
    const changed = isVaried(ctx, d);
    const cls = `week-card${d === date ? ' on' : ''}${d === ctx.today ? ' today' : ''}${closure ? ' closed' : ''}${changed ? ' varied' : ''}`;
    const inner = [
      h(
        'div',
        { class: 'week-card-head' },
        h('span', { class: 'week-wd' }, i18n.weekday(d, 'short')),
        h('span', { class: 'week-num' }, String(+d.slice(8))),
        h('span', { class: 'week-marks', 'aria-hidden': 'true' }, content?.moved ? '↔' : '', changed ? ' •' : ''),
      ),
      closure
        ? h('p', { class: 'week-closed' }, closure.reason || i18n.t('closure_title'))
        : content
          ? h('ul', { class: 'week-dishes' }, shown.map((e) => h('li', { class: e.deleted ? 'struck' : e.replaced ? 'replaced' : '' }, e.deleted ? e.original : e.text, (e.deleted || e.replaced) && h('span', { class: 'sr-only' }, ` (${e.deleted ? i18n.t('dish_deleted') : i18n.t('varied_tag')})`))))
          : h('p', { class: 'week-closed' }, i18n.t('menu_unavailable_title')),
    ];
    return closure || !content ? h('div', { class: cls }, inner) : h('a', { class: cls, href: `#/${d}`, 'aria-current': d === date ? 'date' : undefined }, inner);
  };
  return h('section', { class: 'week', 'aria-label': i18n.t('week_title') }, h('h2', { class: 'overline' }, i18n.t('week_title')), h('div', { class: 'week-grid' }, [0, 1, 2, 3, 4].map((i) => card(addDays(monday, i)))));
}

/** `noticeFor`: «oggi», se si è entrati senza data e oggi non c'è mensa (si mostra il giorno utile dopo, con una spiegazione). */
export function dayView(ctx: Ctx, date: ISODate, noticeFor?: ISODate): HTMLElement {
  const { i18n, model } = ctx;
  const content = model.content(date);
  const main = h('div', { class: 'day-main' }, noticeFor && noticeFor !== date && todayNotice(ctx, noticeFor, date), header(ctx, date), strip(ctx, date), controls(ctx, date));
  const side = h('div', { class: 'day-side' });
  const root = h('div', { class: 'view day' }, main, side);

  side.append(miniMonth(ctx, date));
  if (!content) {
    main.append(model.closure(date) ? closedCard(ctx, date) : unavailableCard(ctx, date));
    side.append(shareRow(ctx, date));
    root.append(weekOverview(ctx, date));
    return root;
  }
  if (content.moved) {
    const from = content.moved.from;
    main.append(
      h(
        'section',
        { class: 'card banner' },
        h('p', null, i18n.t('canteen_moved_banner', `${i18n.weekday(from, 'short')} ${i18n.dateShort(from)}`)),
        content.moved.note && h('p', { class: 'muted' }, content.moved.note),
      ),
    );
  }
  main.append(h('ul', { class: 'card dishes' }, content.entries.map((e) => dishRow(ctx, e, date))));

  const updated = content.entries.filter((e) => e.canteenAt).map((e) => e.canteenAt!);
  if (updated.length) {
    main.append(h('p', { class: 'muted small' }, i18n.t('canteen_badge', i18n.dateShort(toISO(new Date(Math.max(...updated)))))));
  }
  const lines = FOODS.filter((f) => ctx.prefs.foods.includes(f)).map((f) => streakLine(ctx, f, date));
  if (lines.some(Boolean)) side.append(h('div', { class: 'streaks' }, lines));
  side.append(shareRow(ctx, date));
  root.append(weekOverview(ctx, date));
  return root;
}

function shareRow(ctx: Ctx, date: ISODate): HTMLElement {
  const { i18n } = ctx;
  const url = `${location.origin}${location.pathname}#/${date}`;
  return h(
    'div',
    { class: 'share-row' },
    h(
      'button',
      {
        class: 'btn text',
        'data-fk': 'day-share',
        onclick: async () => {
          try {
            if (navigator.share) await navigator.share({ title: `Scodella · ${i18n.dateLong(date)}`, url });
            else {
              await navigator.clipboard.writeText(url);
              ctx.toast(i18n.t('share_copied'));
            }
          } catch {
            /* condivisione annullata */
          }
        },
      },
      icon('share', 18),
      i18n.t('share'),
    ),
    // Dove `webcal:` apre il calendario ci si iscrive subito; altrove si va alle istruzioni con l'indirizzo da copiare.
    ctx.model.menu &&
      h('a', { class: 'btn text', href: opensWebcal() ? webcalUrl(ctx.model.menu.id) : '#/settings/calendar' }, icon('calendar', 18), i18n.t('cal_button')),
  );
}

