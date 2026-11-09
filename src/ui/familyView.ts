import { h } from '../dom';
import { buildFamily, type FamilyColumn } from '../domain/family';
import type { ISODate } from '../domain/dates';
import { profileLabels } from '../prefs';
import type { Ctx } from './ctx';
import { closedCard, controls, strip, todayNotice } from './dayView';
import { menuShortTitle, pill } from './components';

/**
 * «Tutti i menu»: una tabella con una riga per portata e una colonna per bambino. Le portate in cui i bambini hanno piatti diversi hanno un
 * segno (e a parole «diverso»); l'interruttore «Solo le differenze» nasconde le altre. Su telefono la tabella scorre di lato (la colonna
 * delle portate resta ferma), sul desktop sta tutta in vista.
 */
export function familyView(ctx: Ctx, date: ISODate, noticeFor?: ISODate): HTMLElement {
  const { i18n, prefs } = ctx;
  const labels = profileLabels(prefs.profiles, (id) => menuShortTitle(ctx, id));
  const columns: FamilyColumn[] = prefs.profiles.map((p) => ({
    id: p.id,
    label: labels.get(p.id)!,
    menuTitle: p.name ? menuShortTitle(ctx, p.menuId) : '',
    menuId: p.menuId,
    model: ctx.modelFor(p.menuId),
  }));
  const fam = buildFamily(columns, date);

  const root = h(
    'div',
    { class: 'view day family' },
    h(
      'div',
      { class: 'day-main' },
      noticeFor && noticeFor !== date && todayNotice(ctx, noticeFor, date),
      h(
        'header',
        { class: 'day-head' },
        h('h1', { class: 'day-title' }, i18n.weekday(date)),
        h('div', { class: 'day-sub' }, h('span', { class: 'day-date' }, i18n.dateLong(date)), date === ctx.today && pill(i18n.t('today'), 'pill-primary'), pill(i18n.t('family_title'), 'pill-kind')),
      ),
      strip(ctx, date, '/family'),
      controls(ctx, date, '/family'),
    ),
  );
  const main = root.querySelector('.day-main')!;

  if (fam.closed) {
    main.append(closedCard(ctx, date));
    return root;
  }
  if (fam.rows.length === 0) {
    main.append(h('section', { class: 'card notice' }, h('h2', { class: 'card-title' }, i18n.t('menu_unavailable_title')), h('p', null, i18n.t('menu_none'))));
    return root;
  }

  const shown = prefs.familyDiffOnly ? fam.rows.filter((r) => r.differs) : fam.rows;
  main.append(
    h(
      'div',
      { class: 'family-bar' },
      h('p', { class: 'muted small', role: 'status' }, fam.differentCount === 0 ? i18n.t('family_same') : fam.differentCount === 1 ? i18n.t('family_summary_one', 1, fam.rows.length) : i18n.t('family_summary', fam.differentCount, fam.rows.length)),
      fam.differentCount > 0 &&
        h(
          'label',
          { class: 'toggle compact' },
          h('input', { type: 'checkbox', 'data-fk': 'fam-diff', checked: prefs.familyDiffOnly, onchange: (e: Event) => ctx.patch({ familyDiffOnly: (e.target as HTMLInputElement).checked }) }),
          h('span', { class: 'toggle-text' }, h('span', { class: 'toggle-title' }, i18n.t('family_diff_only'))),
        ),
    ),
  );

  const head = h(
    'tr',
    null,
    h('th', { scope: 'col', class: 'fam-corner' }, h('span', { class: 'sr-only' }, i18n.t('family_course'))),
    fam.columns.map((c, i) =>
      h(
        'th',
        { scope: 'col', class: 'fam-col' },
        h('span', { class: 'fam-who' }, c.label),
        c.menuTitle && h('span', { class: 'fam-menu' }, c.menuTitle),
        fam.moved[i] && h('span', { class: 'fam-moved', title: i18n.t('family_moved') }, '↔', h('span', { class: 'sr-only' }, ` ${i18n.t('family_moved')}`)),
      ),
    ),
  );

  const body = shown.map((row) =>
    h(
      'tr',
      { class: row.differs ? 'differs' : '' },
      h(
        'th',
        { scope: 'row', class: 'fam-row' },
        h('span', { class: 'overline' }, i18n.t(`category_${row.category.toLowerCase()}`)),
        row.differs && h('span', { class: 'fam-mark', 'aria-hidden': 'true' }),
        row.differs && h('span', { class: 'sr-only' }, ` (${i18n.t('family_different')})`),
      ),
      row.cells.map((e, i) => {
        if (!e) return h('td', { class: 'fam-cell empty' }, h('span', { class: 'muted' }, i18n.t('family_none')));
        const varied = e.replaced || e.deleted;
        return h(
          'td',
          { class: `fam-cell${varied ? ' varied' : ''}` },
          h(
            'button',
            { class: 'fam-btn', 'data-fk': `fam-${row.slot}-${fam.columns[i].id}`, onclick: () => ctx.openDish(e, date, fam.columns[i].menuId) },
            h('span', { class: `fam-name${e.deleted ? ' struck' : ''}` }, e.deleted ? e.original : e.text),
            varied && h('span', { class: 'tag-varied' }, i18n.t('varied_tag')),
            e.replaced && h('span', { class: 'fam-sub' }, i18n.t('dish_replaced_original', ''), h('s', null, e.original)),
            e.deleted && h('span', { class: 'fam-sub strong' }, i18n.t('dish_deleted')),
          ),
        );
      }),
    ),
  );

  const table = h(
    'table',
    { class: 'family-table' },
    h('caption', { class: 'sr-only' }, i18n.t('family_caption', `${i18n.weekday(date)} ${i18n.dateLong(date)}`)),
    h('thead', null, head),
    h('tbody', null, body),
  );
  table.style.setProperty('--cols', String(fam.columns.length)); // larghezza minima = portate + una colonna per bambino

  main.append(
    h(
      'div',
      { class: 'family-scroll', role: 'region', tabindex: 0, 'aria-label': `${i18n.t('family_title')}. ${i18n.t('family_scroll')}` },
      table,
    ),
  );
  return root;
}
