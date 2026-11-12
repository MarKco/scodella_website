import { h } from '../dom';
import { FOODS, type Food } from '../domain/content';
import { calendarUrl, CONTACT_EMAIL, issueUrl, REPO, webcalUrl } from '../links';
import { MAX_PROFILES, NAME_MAX, profileLabels, type Profile, type ThemeChoice } from '../prefs';
import type { Ctx } from './ctx';
import { languagePicker, menuField, menuShortTitle, playBadge } from './components';

// Chiavi di `settings_show_*` (strings.xml). Non coincidono con quelle delle righe «ultima volta» (`egg_*`, `meat_*`, `fish_*`).
const FOOD_KEY: Record<Food, string> = { EGGS: 'eggs', MEAT: 'meat', FISH: 'fish' };
const THEMES: ThemeChoice[] = ['system', 'light', 'dark'];

/** Lo stato aperto/chiuso di ogni scheda e del suo elenco menu (di base: aperta solo la scheda in uso): sopravvive ai ridisegni. */
const openProfile = new Map<string, boolean>();
const openMenuField = new Map<string, boolean>();
/** Il pannello «Nuovo menu»: nome scritto e menu scelto, prima di confermare con «Aggiungi». */
let addName = '';
let addMenuId: string | null = null;

async function copy(ctx: Ctx, text: string, doneKey: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ctx.toast(ctx.i18n.t(doneKey));
  } catch {
    window.prompt(ctx.i18n.t('cal_address'), text);
  }
}

const nameField = (ctx: Ctx, fk: string, value: string, onChange: (v: string) => void, onInput?: (v: string) => void): HTMLElement =>
  h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label' }, ctx.i18n.t('profile_name')),
    h('input', {
      class: 'date-input name-input',
      type: 'text',
      'data-fk': fk,
      maxlength: NAME_MAX,
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: ctx.i18n.t('profile_name_placeholder'),
      value,
      oninput: (e: Event) => onInput?.((e.target as HTMLInputElement).value),
      onchange: (e: Event) => onChange((e.target as HTMLInputElement).value),
    }),
  );

/** Una scheda per profilo: tutto ciò che riguarda quel bambino (nome, menu, azioni) sta dentro la sua scheda. */
function profileCard(ctx: Ctx, p: Profile, label: string): HTMLElement {
  const { i18n, prefs } = ctx;
  const active = p.id === prefs.activeId;
  return h(
    'details',
    { class: 'profile-item', open: openProfile.get(p.id) ?? active, ontoggle: (e: Event) => openProfile.set(p.id, (e.target as HTMLDetailsElement).open) },
    h(
      'summary',
      { 'data-fk': `pd-${p.id}` },
      h('span', { class: 'pname' }, label),
      p.name && h('span', { class: 'psub' }, menuShortTitle(ctx, p.menuId)),
      active && h('span', { class: 'pill pill-primary' }, i18n.t('profile_active')),
    ),
    h(
      'div',
      { class: 'profile-body' },
      nameField(ctx, `pn-${p.id}`, p.name, (v) => ctx.updateProfile(p.id, { name: v })),
      menuField(ctx, {
        menuId: p.menuId,
        keyPrefix: `pc-${p.id}`,
        open: openMenuField.get(p.id) ?? false,
        onToggle: (o) => openMenuField.set(p.id, o),
        onPick: (menu) => {
          openMenuField.set(p.id, false);
          ctx.updateProfile(p.id, { menuId: menu.id });
        },
      }),
      h(
        'div',
        { class: 'row-actions' },
        !active && h('button', { class: 'btn tonal', 'data-fk': `pu-${p.id}`, onclick: () => ctx.setActiveProfile(p.id) }, i18n.t('profile_use')),
        prefs.profiles.length > 1 &&
          h('button', { class: 'btn text danger', 'data-fk': `pr-${p.id}`, onclick: () => { ctx.removeProfile(p.id); ctx.toast(i18n.t('profile_removed')); } }, i18n.t('profile_remove')),
      ),
    ),
  );
}

/** Il pannello per aggiungere: nome facoltativo, menu (già scelto: lo stesso dell'ultimo bambino, da cambiare se serve) e «Aggiungi». */
function addCard(ctx: Ctx): HTMLElement {
  const { i18n, prefs } = ctx;
  addMenuId ??= prefs.profiles[prefs.profiles.length - 1]?.menuId ?? ctx.model.menu?.id ?? null;
  const done = () => {
    addName = '';
    addMenuId = null;
  };
  return h(
    'section',
    { class: 'profile-item add-card', id: 'add-panel', 'aria-labelledby': 'add-title' },
    h('h3', { class: 'item-title', id: 'add-title' }, i18n.t('profile_new_title')),
    nameField(ctx, 'add-name', addName, (v) => (addName = v), (v) => (addName = v)),
    addMenuId &&
      menuField(ctx, {
        menuId: addMenuId,
        keyPrefix: 'add',
        open: openMenuField.get('add') ?? false, // chiuso: il menu scelto è nella riga e «Aggiungi» resta in vista
        onToggle: (o) => openMenuField.set('add', o),
        onPick: (menu) => {
          addMenuId = menu.id;
          openMenuField.set('add', false);
          ctx.rerender();
        },
      }),
    h(
      'div',
      { class: 'row-actions' },
      h(
        'button',
        {
          class: 'btn primary',
          'data-fk': 'add-confirm',
          onclick: () => {
            if (!addMenuId) return;
            ctx.addProfile({ menuId: addMenuId, name: addName });
            done();
            ctx.toast(i18n.t('profile_added'));
            ctx.go('/settings');
          },
        },
        i18n.t('add_confirm'),
      ),
      h('a', { class: 'btn text', href: '#/settings', 'data-fk': 'menu-cancel', onclick: done }, i18n.t('menu_cancel')),
    ),
  );
}

function myMenus(ctx: Ctx, addMode: boolean): HTMLElement {
  const { i18n, prefs } = ctx;
  const labels = profileLabels(prefs.profiles, (id) => menuShortTitle(ctx, id));
  const box = h('div', { class: 'my-menus' }, h('p', { class: 'muted small' }, i18n.t('my_menus_hint', MAX_PROFILES)));
  box.append(h('div', { class: 'profile-list' }, prefs.profiles.map((p) => profileCard(ctx, p, labels.get(p.id)!))));

  if (prefs.profiles.length < MAX_PROFILES) {
    box.append(addMode ? addCard(ctx) : h('a', { class: 'btn add-btn', href: '#/settings/add-menu', 'data-fk': 'menu-add' }, i18n.t('menu_add')));
  } else {
    box.append(h('p', { class: 'muted small' }, i18n.t('profile_max', MAX_PROFILES)));
  }

  box.append(
    h(
      'div',
      { class: 'row-actions' },
      h('button', { class: 'btn text', 'data-fk': 'menu-share', onclick: () => void copy(ctx, `${location.origin}${location.pathname}${location.search}`, 'share_link_copied') }, i18n.t('share_link')),
      h('button', { class: 'btn text', 'data-fk': 'welcome-redo', onclick: () => ctx.restartWelcome() }, i18n.t('welcome_redo')),
    ),
    h('p', { class: 'muted small' }, `${i18n.t('share_link_hint')} ${i18n.t('welcome_redo_hint')}`),
  );
  return box;
}

/** `open`: istruzioni e indirizzo già visibili (si arriva dal pulsante del giorno su un dispositivo dove `webcal:` non funziona). */
function calendarSection(ctx: Ctx, open: boolean): HTMLElement | null {
  const { i18n, model } = ctx;
  const menu = model.menu;
  if (!menu) return null;
  const address = calendarUrl(menu.id);
  const how = (title: string, text: string) => [h('h3', { class: 'overline' }, i18n.t(title)), h('p', { class: 'muted' }, i18n.t(text))];
  return h(
    'section',
    { class: 'card settings-section', id: 'calendar-section' },
    h('h2', { class: 'card-title', id: 'calendar-title', tabindex: -1 }, i18n.t('cal_title')),
    h('p', { class: 'muted' }, i18n.t('cal_text')),
    h('a', { class: 'btn primary', href: webcalUrl(menu.id) }, i18n.t('cal_button')),
    h(
      'details',
      { class: 'more', open },
      h('summary', null, i18n.t('cal_more')),
      h('label', { class: 'field-label', for: 'cal-address' }, i18n.t('cal_address')),
      h('div', { class: 'copy-row' }, h('input', { id: 'cal-address', class: 'date-input', type: 'text', readonly: true, value: address }), h('button', { class: 'btn tonal', 'data-fk': 'cal-copy', onclick: () => void copy(ctx, address, 'cal_copied') }, i18n.t('cal_copy'))),
      ...how('cal_iphone', 'cal_iphone_text'),
      ...how('cal_google', 'cal_google_text'),
      ...how('cal_outlook', 'cal_outlook_text'),
    ),
  );
}

export function settingsView(ctx: Ctx, addMode = false, calendarOpen = false): HTMLElement {
  const { i18n, model, prefs } = ctx;
  const section = (title: string, ...children: (Node | false | null)[]) =>
    h('section', { class: 'card settings-section' }, h('h2', { class: 'card-title' }, title), ...children);

  const colA = h('div', { class: 'col' });
  const colB = h('div', { class: 'col' });
  const root = h('div', { class: 'view settings' }, h('h1', { class: 'page-title' }, i18n.t('nav_settings')), h('div', { class: 'settings-grid' }, colA, colB));

  colA.append(section(i18n.t('my_menus'), myMenus(ctx, addMode)));
  colA.append(section(i18n.t('settings_language'), languagePicker(ctx)));

  colB.append(
    section(
      i18n.t('settings_look_section'),
      h('div', { class: 'field-label' }, i18n.t('theme')),
      h(
        'div',
        { class: 'chips', role: 'group', 'aria-label': i18n.t('theme') },
        THEMES.map((th) => h('button', { class: `chip${prefs.theme === th ? ' on' : ''}`, 'data-fk': `theme-${th}`, 'aria-pressed': prefs.theme === th, onclick: () => ctx.patch({ theme: th }) }, i18n.t(`theme_${th}`))),
      ),
      h(
        'div',
        { class: 'toggles' },
        FOODS.map((f) => {
          const key = FOOD_KEY[f];
          const on = prefs.foods.includes(f);
          return h(
            'label',
            { class: 'toggle' },
            h('input', {
              type: 'checkbox',
              'data-fk': `food-${f}`,
              checked: on,
              onchange: (e: Event) => ctx.patch({ foods: (e.target as HTMLInputElement).checked ? [...prefs.foods, f] : prefs.foods.filter((x) => x !== f) }),
            }),
            h('span', { class: 'toggle-text' }, h('span', { class: 'toggle-title' }, i18n.t(`settings_show_${key}`)), h('span', { class: 'toggle-hint' }, i18n.t(`settings_show_${key}_hint`))),
          );
        }),
      ),
    ),
  );

  const calendar = calendarSection(ctx, calendarOpen);
  if (calendar) colB.append(calendar);

  // App Android (assente su iPhone/iPad).
  const badge = playBadge(ctx);
  if (badge) colB.append(section(i18n.t('play_settings_title'), h('p', { class: 'muted' }, i18n.t('play_settings_text')), badge));

  // Installazione come PWA.
  if (ctx.install.installed) {
    colB.append(section(i18n.t('install_title'), h('p', { class: 'muted' }, i18n.t('install_done'))));
  } else if (ctx.install.available || ctx.install.ios) {
    colB.append(
      section(
        i18n.t('install_title'),
        h('p', { class: 'muted' }, i18n.t('install_hint')),
        ctx.install.available && h('button', { class: 'btn primary', onclick: () => void ctx.install.prompt() }, i18n.t('install_button')),
        ctx.install.ios && h('p', null, i18n.t('install_ios')),
      ),
    );
  }

  const updated = ctx.feedOk && model.feed.updatedAt ? i18n.t('feed_updated', i18n.dateTime(model.feed.updatedAt)) : i18n.t('feed_none');
  colB.append(
    section(
      i18n.t('settings_info_section'),
      h('p', null, h('strong', null, 'Scodella'), ` · ${i18n.t('info_unofficial')}`),
      h('p', { class: 'muted' }, i18n.t('info_data_text')),
      h('p', { class: 'muted' }, `${updated}. ${i18n.t('feed_hint')}`),
      h('h3', { class: 'overline' }, i18n.t('info_privacy_web')),
      h('p', { class: 'muted' }, i18n.t('info_privacy_web_text')),
      h('p', { class: 'muted contact' }, `${i18n.t('info_contact')}: `, h('a', { href: `mailto:${CONTACT_EMAIL}` }, CONTACT_EMAIL)),
      h(
        'p',
        { class: 'muted small links' },
        `${i18n.t('version_label')} ${__APP_VERSION__}`,
        ' · ',
        h('a', { href: REPO, target: '_blank', rel: 'noopener noreferrer' }, i18n.t('source_code')),
        ' · ',
        h('a', { href: issueUrl({ menu: model.menu?.id ?? '-', lang: i18n.lang }), target: '_blank', rel: 'noopener noreferrer' }, i18n.t('report_error')),
      ),
    ),
  );
  return root;
}
