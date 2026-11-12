import { h } from '../dom';
import { MAX_PROFILES, NAME_MAX } from '../prefs';
import type { Ctx } from './ctx';
import { languagePicker, menuField } from './components';

interface Draft {
  name: string;
  menuId: string;
  /** L'elenco dei menu della scheda è aperto. */
  open: boolean;
}

/** Le schede in modifica: sopravvivono ai ridisegni (cambio lingua, scelta di un menu) finché non si preme «Continua». */
let draft: Draft[] | null = null;

/** Scarta la bozza (usata dai test per partire sempre da zero). */
export function resetWelcomeDraft(): void {
  draft = null;
}

/**
 * Prima apertura: lingua e, per ogni bambino, un menu e un nome facoltativo (fino a `MAX_PROFILES`, anche lo stesso menu). Con un solo bambino è quasi
 * la schermata di prima: si sceglie il menu e si prosegue. Si può cambiare tutto dalle Impostazioni.
 */
export function welcomeView(ctx: Ctx, onDone: () => void, onCancel?: () => void): HTMLElement {
  const { i18n, model } = ctx;
  const fallback = model.menu?.id ?? model.menus[0]?.id ?? '';
  // Se ci sono già profili (si ripete la configurazione) si parte da quelli; altrimenti una scheda col menu di partenza.
  const cards = (draft ??= ctx.prefs.profiles.length
    ? ctx.prefs.profiles.map((p, i) => ({ name: p.name, menuId: p.menuId, open: i === 0 }))
    : [{ name: '', menuId: fallback, open: true }]);

  const card = (d: Draft, i: number) =>
    h(
      'section',
      { class: 'card profile-card' },
      h(
        'div',
        { class: 'profile-card-head' },
        h('h2', { class: 'card-title' }, i18n.t('child_n', i + 1)),
        i > 0 && h('button', { class: 'btn text', 'data-fk': `wl-remove-${i}`, onclick: () => { cards.splice(i, 1); ctx.rerender(); } }, i18n.t('profile_remove')),
      ),
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'field-label' }, i18n.t('profile_name')),
        h('input', {
          class: 'date-input name-input',
          type: 'text',
          'data-fk': `wl-name-${i}`,
          maxlength: NAME_MAX,
          autocomplete: 'off',
          spellcheck: 'false',
          placeholder: i18n.t('profile_name_placeholder'),
          value: d.name,
          oninput: (e: Event) => { d.name = (e.target as HTMLInputElement).value; },
        }),
      ),
      h('p', { class: 'muted small' }, i18n.t('profile_name_hint')),
      menuField(ctx, {
        menuId: d.menuId,
        keyPrefix: `wl${i}`,
        open: d.open,
        onToggle: (o) => { d.open = o; },
        // Scelto il menu l'elenco si chiude: lascia spazio per aggiungere gli altri bambini.
        onPick: (menu) => { d.menuId = menu.id; d.open = false; ctx.rerender(); },
      }),
    );

  return h(
    'div',
    { class: 'view welcome' },
    h('img', { class: 'welcome-logo', src: `${import.meta.env.BASE_URL}icons/icon.svg`, alt: '', width: 96, height: 96 }),
    h('h1', { class: 'page-title' }, i18n.t('welcome_title')),
    h('p', { class: 'muted' }, i18n.t('welcome_subtitle')),
    h('div', { class: 'field-label' }, i18n.t('welcome_language')),
    languagePicker(ctx),
    h('p', { class: 'muted' }, i18n.t('welcome_multi_hint', MAX_PROFILES)),
    cards.map(card),
    cards.length < MAX_PROFILES &&
      h(
        'button',
        {
          class: 'btn tonal',
          'data-fk': 'wl-add',
          onclick: () => {
            // Si lavora sul bambino nuovo: il suo elenco dei menu è aperto, quelli degli altri sono chiusi.
            for (const c of cards) c.open = false;
            cards.push({ name: '', menuId: cards[cards.length - 1].menuId, open: true });
            ctx.rerender();
          },
        },
        i18n.t('profile_add_child'),
      ),
    h('p', { class: 'muted small' }, i18n.t('welcome_settings_hint')),
    h(
      'button',
      {
        class: 'btn primary wide',
        'data-fk': 'wl-continue',
        onclick: () => {
          ctx.setProfiles(cards.map(({ name, menuId }) => ({ name, menuId })));
          draft = null;
          onDone();
        },
      },
      i18n.t('welcome_continue'),
    ),
    onCancel &&
      h('button', { class: 'btn text wide', 'data-fk': 'wl-cancel', onclick: () => { draft = null; onCancel(); } }, i18n.t('menu_cancel')),
  );
}
