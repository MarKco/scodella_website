import { h } from '../dom';
import { toISO } from '../domain/dates';
import type { DishEntry } from '../domain/content';
import { findRecipe } from '../domain/recipes';
import type { ISODate } from '../domain/dates';
import type { Ctx } from './ctx';
import { icon } from './icons';
import { openSheet, pill } from './components';
import { kindEmoji } from './kinds';
import { issueUrl, safeHttpUrl } from '../links';

const allergenLabel = (ctx: Ctx, code: string) => {
  const key = `allergen_${code.toLowerCase()}`;
  const label = ctx.i18n.t(key);
  return label === key ? code : label;
};

export function openDishSheet(ctx: Ctx, e: DishEntry, date: ISODate): void {
  const { i18n, model } = ctx;
  const body: Node[] = [];
  const shown = e.deleted ? e.original : e.text;

  const meta = h('div', { class: 'sheet-meta' }, pill(i18n.t(`category_${e.category.toLowerCase()}`)));
  if (e.kind) meta.append(pill(`${kindEmoji(e.kind)} ${i18n.t(`kind_${e.kind.toLowerCase()}`)}`, 'pill-kind'));
  if (e.eggs && !e.deleted) meta.append(pill(`🥚 ${i18n.t('allergen_eggs')}`));
  if (model.menu?.diet) meta.append(pill(model.names.menuTitle(model.menu)));
  body.push(meta);

  if (e.replaced) body.push(h('p', { class: 'muted' }, i18n.t('dish_replaced_original', ''), h('s', null, e.original)));
  if (e.deleted) body.push(h('p', { class: 'strong' }, i18n.t('dish_deleted')));
  if (e.canteenAt) body.push(h('p', { class: 'muted small' }, i18n.t('dish_variation_note', i18n.dateLong(toISO(new Date(e.canteenAt))))));
  if (e.note && !e.deleted) body.push(h('p', { class: 'dish-note' }, e.note));

  const found = e.recipeKey && model.menu ? findRecipe(model.recipes(), model.menu, e.recipeKey) : null;
  if (found && model.menu) {
    const { recipe } = found;
    const season = model.menu.season;
    const seasonRecipes = model.recipes()!;
    body.push(
      h(
        'section',
        { class: 'sheet-section' },
        h('h3', { class: 'overline' }, i18n.t('dish_info_ingredients')),
        h(
          'ul',
          { class: 'ingredients' },
          recipe.ingredients.map((id) => {
            const ing = seasonRecipes.ingredients[id];
            const name = model.names.ingredient(season, id, 'name', ing?.name) ?? id;
            const comp = model.names.ingredient(season, id, 'composition', ing?.composition);
            return h(
              'li',
              null,
              h('span', { class: 'ing-name' }, name),
              ing?.organic && pill(i18n.t('dish_info_organic'), 'pill-green'),
              ing?.frozen && pill(i18n.t('dish_info_frozen')),
              comp && h('span', { class: 'ing-comp' }, comp),
            );
          }),
        ),
      ),
    );
    const chips = (codes: string[]) =>
      codes.length ? h('div', { class: 'chips static' }, codes.map((c) => pill(allergenLabel(ctx, c)))) : h('p', { class: 'muted' }, i18n.t('info_none'));
    body.push(h('section', { class: 'sheet-section' }, h('h3', { class: 'overline' }, i18n.t('info_allergens')), chips(recipe.allergens)));
    if (recipe.traces.length) {
      body.push(h('section', { class: 'sheet-section' }, h('h3', { class: 'overline' }, i18n.t('info_traces')), chips(recipe.traces)));
    }
    const flags = recipe.flags.map((f) => (f === 'FROZEN' ? i18n.t('flag_frozen') : f === 'CONTAINS_PORK' ? i18n.t('flag_pork') : null)).filter(Boolean);
    if (flags.length) body.push(h('p', { class: 'muted' }, flags.join(' · ')));
    const source = safeHttpUrl(recipe.url);
    if (source) {
      body.push(
        h('a', { class: 'btn text', href: source, target: '_blank', rel: 'noopener noreferrer' }, i18n.t('info_source'), icon('external', 16)),
      );
    }
  } else if (!e.deleted) {
    body.push(h('p', { class: 'muted' }, i18n.t('dish_ingredients_none')));
  }
  if (model.menu) {
    body.push(
      h('a', { class: 'btn text', href: issueUrl({ menu: model.menu.id, date, lang: i18n.lang }), target: '_blank', rel: 'noopener noreferrer' }, i18n.t('report_day'), icon('external', 16)),
    );
  }
  openSheet(shown, body, i18n.t('close'));
}
