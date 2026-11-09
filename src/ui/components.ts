import { h } from '../dom';
import { seasons, inSeason, selectableSeasons, switchSeason } from '../domain/menus';
import type { Menu } from '../domain/types';
import { LANGS } from '../i18n';
import { isIos, PLAY_URL } from '../platform';
import { MAX_PROFILES, profileLabels } from '../prefs';
import type { Ctx } from './ctx';
import { icon } from './icons';

/** Finestra modale nativa (<dialog>): chiude con Esc, tocco sullo sfondo o il pulsante. */
let sheetCount = 0;

export function openSheet(title: string, body: Node[], closeLabel: string, onClose?: () => void): HTMLDialogElement {
  const titleId = `sheet-title-${++sheetCount}`;
  const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': titleId });
  const close = () => dlg.close();
  dlg.append(
    h('header', { class: 'sheet-head' }, h('h2', { class: 'sheet-title', id: titleId }, title), h('button', { class: 'icon-btn', 'aria-label': closeLabel, onclick: close }, icon('close'))),
    h('div', { class: 'sheet-body' }, ...body),
  );
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  dlg.addEventListener('close', () => {
    dlg.remove();
    onClose?.();
  });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

export function pill(text: string, cls = ''): HTMLElement {
  return h('span', { class: `pill ${cls}`.trim() }, text);
}

/** Selettore di menu in due passi come nell'app: stagione, poi dieta (o menu standard). */
export interface PickerOptions {
  /** Menu da non offrire (già scelti). */
  exclude?: string[];
  /** Il menu evidenziato: quello del profilo che si sta modificando (di base, il menu attivo). */
  selectedId?: string | null;
  /** Prefisso delle chiavi di focus, per distinguere più elenchi nella stessa pagina. */
  keyPrefix?: string;
}

export function menuPicker(ctx: Ctx, onPick: (menu: Menu) => void, opts: PickerOptions = {}): HTMLElement {
  const { model, i18n } = ctx;
  const selected = opts.selectedId === undefined ? model.menu : (model.menus.find((m) => m.id === opts.selectedId) ?? null);
  const exclude = opts.exclude ?? [];
  const kp = opts.keyPrefix ? `${opts.keyPrefix}-` : '';
  const wrap = h('div', { class: 'menu-picker' });
  const open = selectableSeasons(model.menus, ctx.today);
  if (open.length > 1 && selected) {
    const select = h(
      'select',
      {
        class: 'select',
        'data-fk': `${kp}season`,
        'aria-label': i18n.t('settings_menu_season'),
        onchange: (e: Event) => {
          const next = switchSeason(model.menus, selected, (e.target as HTMLSelectElement).value);
          if (next) onPick(next);
        },
      },
      open.map((m) => h('option', { value: m.id, selected: m.season === selected.season }, model.names.menu(m))),
    );
    wrap.append(h('label', { class: 'field' }, h('span', { class: 'field-label' }, i18n.t('settings_menu_season')), select));
  }
  // L'elenco è quello della stagione del menu evidenziato; senza un menu evidenziato, quella del menu in uso (mai solo i menu «base»).
  const reference = selected ?? model.menu;
  const list = (reference ? inSeason(model.menus, reference.season) : seasons(model.menus)).filter((m) => !exclude.includes(m.id));
  const standard = list.find((m) => m.diet === null);
  const diets = list.filter((m) => m.diet !== null);
  const option = (m: Menu, title: string, hint: string | null) =>
    h(
      'button',
      { class: `choice${m.id === selected?.id ? ' on' : ''}`, 'data-fk': `${kp}choice-${m.id}`, 'aria-pressed': m.id === selected?.id, onclick: () => onPick(m) },
      h('span', { class: 'choice-text' }, h('span', { class: 'choice-title' }, title), hint && h('span', { class: 'choice-hint' }, hint)),
      m.id === selected?.id && icon('check', 20),
    );
  const group = h('div', { class: 'choices', role: 'group', 'aria-label': i18n.t('settings_menu_section') });
  if (standard) group.append(option(standard, i18n.t('welcome_standard'), i18n.t('welcome_standard_hint')));
  if (diets.length) group.append(h('div', { class: 'overline' }, i18n.t('welcome_diets')));
  for (const d of diets) group.append(option(d, model.names.menuTitle(d), model.names.dietNote(d)));
  wrap.append(group);
  return wrap;
}

export interface MenuFieldOptions {
  menuId: string;
  onPick: (menu: Menu) => void;
  keyPrefix: string;
  open: boolean;
  onToggle?: (open: boolean) => void;
}

/**
 * «Menu: Menu standard — Cambia»: la riga che mostra il menu scelto e, aprendola, l'elenco per cambiarlo. Stessa riga nella schermata
 * iniziale, nelle schede delle Impostazioni e nel pannello per aggiungere: sempre dentro la scheda del bambino a cui si riferisce.
 */
export function menuField(ctx: Ctx, o: MenuFieldOptions): HTMLElement {
  const { i18n } = ctx;
  return h(
    'details',
    { class: 'menu-field', open: o.open, ontoggle: (e: Event) => o.onToggle?.((e.target as HTMLDetailsElement).open) },
    h(
      'summary',
      { 'data-fk': `${o.keyPrefix}-field` },
      h('span', { class: 'mf-label' }, i18n.t('profile_menu')),
      h('span', { class: 'mf-value' }, menuShortTitle(ctx, o.menuId)),
      h('span', { class: 'mf-change', 'aria-hidden': 'true' }, i18n.t('menu_change_short')),
      h('span', { class: 'mf-close', 'aria-hidden': 'true' }, i18n.t('menu_close_short')),
    ),
    menuPicker(ctx, o.onPick, { selectedId: o.menuId, keyPrefix: o.keyPrefix }),
  );
}

export function languagePicker(ctx: Ctx): HTMLElement {
  return h(
    'div',
    { class: 'chips', role: 'group', 'aria-label': ctx.i18n.t('settings_language') },
    LANGS.map((l) =>
      h('button', { class: `chip${l.code === ctx.i18n.lang ? ' on' : ''}`, 'data-fk': `lang-${l.code}`, 'aria-pressed': l.code === ctx.i18n.lang, lang: l.code, onclick: () => void ctx.setLang(l.code) }, l.native),
    ),
  );
}

// --- badge dell'app Android -----------------------------------------------------------------------------------------

/**
 * Il badge ufficiale «Disponibile su Google Play», non modificato (linee guida di Google: niente ritagli, rotazioni o
 * animazioni, spazio libero attorno: i PNG lo includono già). Mai su iPhone/iPad, dove l'app non esiste.
 */
export function playBadge(ctx: Ctx, height = 56): HTMLElement | null {
  if (isIos()) return null;
  const lang = ['it', 'en', 'hi', 'bn', 'te', 'ta', 'mr'].includes(ctx.i18n.lang) ? ctx.i18n.lang : 'en';
  return h(
    'a',
    { class: 'play-badge', href: PLAY_URL, target: '_blank', rel: 'noopener noreferrer', 'aria-label': ctx.i18n.t('play_badge_alt') },
    h('img', { src: `${import.meta.env.BASE_URL}badges/google-play-${lang}.png`, alt: ctx.i18n.t('play_badge_alt'), height, width: Math.round((height * 646) / 250), loading: 'lazy' }),
  );
}

/** Striscia chiudibile in cima al contenuto; una volta chiusa non ricompare. */
export function playBanner(ctx: Ctx): HTMLElement | null {
  const badge = playBadge(ctx, 40);
  if (!badge || ctx.prefs.playBannerDismissed) return null;
  return h(
    'aside',
    { class: 'play-banner', 'aria-label': ctx.i18n.t('play_settings_title') },
    badge,
    h('p', { class: 'play-banner-text' }, ctx.i18n.t('play_banner_text')),
    h('button', { class: 'icon-btn', 'data-fk': 'play-close', 'aria-label': ctx.i18n.t('play_banner_close'), onclick: () => ctx.patch({ playBannerDismissed: true }) }, icon('close', 20)),
  );
}

// --- profili (bambino + menu) ----------------------------------------------------------------------------------------

/** Nome breve di un menu: la dieta, oppure «Menu standard» per il menu base della stagione. */
export function menuShortTitle(ctx: Ctx, menuId: string): string {
  const m = ctx.model.menus.find((x) => x.id === menuId);
  if (!m) return menuId;
  return m.diet ? ctx.model.names.menuTitle(m) : ctx.i18n.t('welcome_standard');
}

/**
 * La riga in cima a ogni vista: i profili come chip (da 2 in su si passa dall'uno all'altro con un tocco) e «＋ Aggiungi», che porta
 * alle Impostazioni già sul pannello per aggiungere un menu. La X nasconde il suggerimento «＋ Aggiungi» (resta nelle Impostazioni).
 */
export function profileBar(ctx: Ctx): HTMLElement | null {
  const { prefs, i18n } = ctx;
  const profiles = prefs.profiles;
  if (profiles.length === 0) return null;
  const showAdd = profiles.length < MAX_PROFILES && !prefs.profileHintDismissed;
  if (profiles.length === 1 && !showAdd) return null;
  const labels = profileLabels(profiles, (id) => menuShortTitle(ctx, id));

  const chips =
    profiles.length === 1
      ? [h('a', { class: 'chip on', href: '#/settings', 'data-fk': 'bar-edit' }, labels.get(profiles[0].id), h('span', { class: 'sr-only' }, ` · ${i18n.t('home_edit')}`))]
      : profiles.map((p) =>
          h(
            'button',
            { class: `chip${p.id === prefs.activeId && !ctx.isFamily ? ' on' : ''}`, 'data-fk': `bar-${p.id}`, 'aria-pressed': p.id === prefs.activeId && !ctx.isFamily, onclick: () => ctx.setActiveProfile(p.id) },
            labels.get(p.id),
          ),
        );
  return h(
    'nav',
    { class: 'switcher', 'data-no-swipe': '', 'aria-label': i18n.t('my_menus') },
    chips,
    // «Tutti»: i menu di tutti i bambini affiancati, per il giorno che si stava guardando (o oggi).
    profiles.length >= 2 &&
      h('a', { class: `chip${ctx.isFamily ? ' on' : ''}`, 'data-fk': 'bar-all', href: `#/family${ctx.viewDate ? `/${ctx.viewDate}` : ''}`, 'aria-current': ctx.isFamily ? 'page' : undefined }, i18n.t('family_all')),
    showAdd && h('a', { class: 'chip add', href: '#/settings/add-menu', 'data-fk': 'bar-add' }, i18n.t('home_add'), h('span', { class: 'sr-only' }, i18n.t('home_add_more'))),
    showAdd && h('button', { class: 'icon-btn small', 'data-fk': 'bar-hide', 'aria-label': i18n.t('home_hide_label'), onclick: () => ctx.patch({ profileHintDismissed: true }) }, icon('close', 18)),
  );
}
