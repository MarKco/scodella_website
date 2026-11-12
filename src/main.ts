import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { loadFeed, loadPack, loadStatic } from './data';
import { clear, h } from './dom';
import { pickMessage } from './domain/feed';
import { Model, type StaticData } from './domain/model';
import { accentScheme } from './domain/theme';
import { parseISO, type ISODate } from './domain/dates';
import { EMPTY_PACK, type Feed, type LangPack } from './domain/types';
import { detectLang, I18n, LANGS } from './i18n';
import { initManifest, updateManifest } from './manifest';
import { isIos, isStandalone } from './platform';
import { focusKey, restoreFocus } from './focus';
import { activeMenuId, addProfile, loadPrefs, removeProfile, resetPrefs, savePrefs, setActive, setProfiles, updateProfile, type Prefs, type ThemeChoice } from './prefs';
import { mergeUrlState } from './startup';
import { viewChanged, type Period, type Route } from './route';
import { currentToday, simulatedToday } from './today';
import { applyState, parseState, startSearch } from './urlstate';
import { calendarView } from './ui/calendarView';
import { openSheet, playBanner, profileBar } from './ui/components';
import type { Ctx } from './ui/ctx';
import { dayView } from './ui/dayView';
import { familyView } from './ui/familyView';
import { openDishSheet } from './ui/dishSheet';
import { icon } from './ui/icons';
import { settingsView } from './ui/settingsView';
import { statsView } from './ui/statsView';
import { welcomeView } from './ui/welcome';

const appEl = document.getElementById('app')!;

interface State {
  data: StaticData;
  pack: LangPack;
  fallback: LangPack;
  feed: Feed;
  feedOk: boolean;
  prefs: Prefs;
  model: Model;
  i18n: I18n;
  today: ISODate;
  /** Un modello per ogni menu seguito (le colonne della vista «Tutti»), creati a richiesta. */
  models: Map<string, Model>;
}

let state: State;
let lastDay: ISODate | null = null;
let deferredInstall: (Event & { prompt(): Promise<void> }) | null = null;
/** La schermata iniziale si mostra finché non è confermata (`prefs.welcomed`); «Ripeti la configurazione» la riapre. */
const isWelcome = (): boolean => !state.prefs.welcomed && state.model.menus.length > 0;
let welcomeShown = false;


// --- stato ------------------------------------------------------------------------------------------------------

function build(partial: Pick<State, 'data' | 'pack' | 'fallback' | 'feed' | 'feedOk' | 'prefs'>): State {
  const lang = partial.prefs.lang ?? detectLang();
  const today = currentToday();
  return {
    ...partial,
    today,
    models: new Map(),
    model: new Model(partial.data, partial.feed, partial.pack, lang, activeMenuId(partial.prefs), today),
    i18n: new I18n(lang, partial.pack, partial.fallback),
  };
}

function update(patch: Partial<State>): void {
  state = build({ ...state, ...patch });
  render();
}

function patchPrefs(p: Partial<Prefs>): void {
  const prefs = { ...state.prefs, ...p };
  savePrefs(prefs);
  update({ prefs });
}

function setPrefs(prefs: Prefs): void {
  savePrefs(prefs);
  update({ prefs });
}

async function setLang(code: string): Promise<void> {
  if (!LANGS.some((l) => l.code === code)) return;
  const pack = await loadPack(code);
  const prefs = { ...state.prefs, lang: code };
  savePrefs(prefs);
  update({ pack, prefs });
}

// --- tema -------------------------------------------------------------------------------------------------------

function applyTheme(): void {
  const { prefs, model } = state;
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  const vars = accentScheme(model.menu?.accent, dark);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.lang = state.i18n.lang;
  // Nell'HTML ci sono due meta (chiaro/scuro) per il primo paint: qui ne resta uno solo, che segue la scelta dell'utente.
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((m, i) => (i === 0 ? (m.removeAttribute('media'), m.setAttribute('content', vars['--background'])) : m.remove()));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state && applyTheme());

// --- toast ------------------------------------------------------------------------------------------------------

let toastTimer = 0;
function toast(message: string): void {
  document.querySelector('.toast')?.remove();
  // Visibile per tutti; ai lettori di schermo lo dice `#announcer`, che esiste dall'avvio (una regione live inserita già piena
  // spesso non viene letta).
  const el = h('div', { class: 'toast', 'aria-hidden': 'true' }, message);
  document.body.append(el);
  announce(message);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 3500);
}

/** Fa leggere `message` ai lettori di schermo dalla regione live `#announcer` (svuotata prima, così anche un testo ripetuto si legge). */
function announce(message: string): void {
  const live = document.getElementById('announcer');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => (live.textContent = message));
}

// --- routing ----------------------------------------------------------------------------------------------------

function parseRoute(): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b] = parts;
  if (a === 'calendar') return { name: 'calendar', month: /^\d{4}-\d{2}$/.test(b ?? '') ? b : (lastDay ?? state.today).slice(0, 7) };
  if (a === 'stats') return { name: 'stats', period: (['7', '30', '90', 'year', 'all'].includes(b) ? b : 'year') as Period };
  if (a === 'settings') return { name: 'settings', add: b === 'add-menu', calendar: b === 'calendar' };
  if (a === 'family') return b && parseISO(b) ? { name: 'family', date: b } : { name: 'family', date: state.model.onOrAfter(state.today), fromToday: true };
  if (a && parseISO(a)) return { name: 'day', date: a };
  // Senza indirizzo: si riapre sull'ultima vista del giorno (con almeno 2 bambini può essere «Tutti»).
  const date = state.model.onOrAfter(state.today);
  return state.prefs.startFamily && state.prefs.profiles.length >= 2 ? { name: 'family', date, fromToday: true } : { name: 'day', date, fromToday: true };
}

/** Il modello di un menu (quello in uso è già costruito; gli altri si creano a richiesta e restano finché lo stato non cambia). */
function modelFor(menuId: string): Model {
  if (state.model.menu?.id === menuId) return state.model;
  let m = state.models.get(menuId);
  if (!m) {
    m = new Model(state.data, state.feed, state.pack, state.i18n.lang, menuId, state.today);
    state.models.set(menuId, m);
  }
  return m;
}

/** La rotta della pagina attuale (per sapere in `ctx()` se si sta guardando «Tutti» e quale giorno). */
let currentRoute: Route | null = null;

const ctx = (): Ctx => ({
  model: state.model,
  i18n: state.i18n,
  prefs: state.prefs,
  feedOk: state.feedOk,
  today: state.today,
  go: (path) => {
    location.hash = `#${path}`;
  },
  patch: patchPrefs,
  // Dalla vista «Tutti», toccare un bambino porta alla sua pagina del giorno (lo stesso giorno).
  setActiveProfile: (id) => {
    const r = parseRoute();
    setPrefs(setActive(state.prefs, id));
    if (r.name === 'family') location.hash = `#/${r.date}`;
  },
  addProfile: (init) => setPrefs(addProfile(state.prefs, init)),
  updateProfile: (id, patch) => setPrefs(updateProfile(state.prefs, id, patch)),
  removeProfile: (id) => setPrefs(removeProfile(state.prefs, id)),
  setProfiles: (list) => setPrefs(setProfiles(state.prefs, list)),
  restartWelcome: () => patchPrefs({ welcomed: false }),
  setLang,
  openDish: (entry, date, menuId) => openDishSheet(menuId ? { ...ctx(), model: modelFor(menuId) } : ctx(), entry, date),
  modelFor,
  isFamily: currentRoute?.name === 'family',
  viewDate: currentRoute && 'date' in currentRoute ? currentRoute.date : null,
  toast,
  install: {
    available: !!deferredInstall,
    installed: isStandalone(),
    ios: isIos() && !isStandalone(),
    prompt: async () => {
      if (!deferredInstall) return;
      await deferredInstall.prompt();
      deferredInstall = null;
      render();
    },
  },
});

// --- shell ------------------------------------------------------------------------------------------------------

const TABS = [
  { name: 'day', icon: 'day', label: 'nav_day', href: '#/' },
  { name: 'calendar', icon: 'calendar', label: 'nav_calendar', href: '#/calendar' },
  { name: 'stats', icon: 'stats', label: 'nav_stats', href: '#/stats' },
  { name: 'settings', icon: 'settings', label: 'nav_settings', href: '#/settings' },
] as const;

/** Quale voce di navigazione è attiva: «Tutti i menu» sta sotto «Giorno». */
const tabName = (r: Route | null) => (r?.name === 'family' ? 'day' : r?.name);

const THEME_CYCLE: ThemeChoice[] = ['system', 'light', 'dark'];
const THEME_ICON: Record<ThemeChoice, string> = { system: '◐', light: '☀', dark: '☾' };

/** Barra laterale (solo desktop, ≥ 1024 px): navigazione, lingua e tema sempre a portata di mano. */
function sidebar(route: Route | null, c: Ctx): HTMLElement {
  const menu = state.model.menu;
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(state.prefs.theme) + 1) % THEME_CYCLE.length];
  return h(
    'aside',
    { class: 'sidebar' },
    h(
      'a',
      { class: 'brand', href: '#/settings' },
      h('img', { class: 'logo', src: `${import.meta.env.BASE_URL}icons/icon.svg`, alt: '', width: 44, height: 44 }),
      h('span', { class: 'brand-text' }, h('span', { class: 'app-name' }, 'Scodella'), menu && h('span', { class: 'topbar-menu' }, state.model.names.menuTitle(menu))),
    ),
    h(
      'nav',
      { class: 'side-nav', 'aria-label': c.i18n.t('sidebar_nav') },
      TABS.map((t) =>
        h('a', { class: `side-link${tabName(route) === t.name ? ' on' : ''}`, href: t.href, 'aria-current': tabName(route) === t.name ? 'page' : undefined }, icon(t.icon), h('span', null, c.i18n.t(t.label))),
      ),
    ),
    h(
      'div',
      { class: 'side-foot' },
      h(
        'div',
        { class: 'side-tools' },
        h(
          'select',
          { class: 'select', 'data-fk': 'side-lang', 'aria-label': c.i18n.t('settings_language'), onchange: (e: Event) => void setLang((e.target as HTMLSelectElement).value) },
          LANGS.map((l) => h('option', { value: l.code, lang: l.code, selected: l.code === c.i18n.lang }, l.native)),
        ),
        h('button', { class: 'icon-btn', 'data-fk': 'side-theme', title: c.i18n.t('theme_cycle'), 'aria-label': `${c.i18n.t('theme_cycle')}: ${c.i18n.t(`theme_${state.prefs.theme}`)}`, onclick: () => patchPrefs({ theme: next }) }, h('span', { class: 'theme-glyph', 'aria-hidden': 'true' }, THEME_ICON[state.prefs.theme])),
      ),
      h('p', { class: 'muted small' }, c.i18n.t('sidebar_unofficial')),
    ),
  );
}

function withoutSimulation(): string {
  const u = new URL(location.href);
  u.searchParams.delete('oggi');
  return u.href;
}

function shell(route: Route | null, view: HTMLElement): HTMLElement {
  const c = ctx();
  const menu = state.model.menu;
  const banner = playBanner(c);
  const sim = simulatedToday();
  return h(
    'div',
    { class: 'shell' },
    h('a', { class: 'skip', href: '#main', onclick: (e: Event) => { e.preventDefault(); document.getElementById('main')?.focus(); } }, c.i18n.t('skip_to_content')),
    sidebar(route, c),
    h(
      'header',
      { class: 'topbar' },
      h('img', { class: 'logo', src: `${import.meta.env.BASE_URL}icons/icon.svg`, alt: '', width: 32, height: 32 }),
      h('div', { class: 'topbar-text' }, h('div', { class: 'app-name' }, 'Scodella'), menu && h('div', { class: 'topbar-menu' }, state.model.names.menuTitle(menu))),
      !navigator.onLine && h('span', { class: 'pill', 'aria-hidden': 'true' }, c.i18n.t('offline').split(':')[0]),
    ),
    h(
      'main',
      { id: 'main', class: 'main', tabindex: -1 },
      sim && h('p', { class: 'sim-note', role: 'note' }, c.i18n.t('sim_note', `${c.i18n.weekday(sim)} ${c.i18n.dateLong(sim)}`), ' ', h('a', { href: withoutSimulation() }, c.i18n.t('sim_back'))),
      !navigator.onLine && h('p', { class: 'offline-note', role: 'status' }, c.i18n.t('offline')),
      profileBar(c),
      banner,
      view,
    ),
    h(
      'nav',
      { class: 'tabs', 'aria-label': 'Scodella' },
      TABS.map((t) =>
        h('a', { class: `tab${tabName(route) === t.name ? ' on' : ''}`, href: t.href, 'aria-current': tabName(route) === t.name ? 'page' : undefined }, icon(t.icon), h('span', null, c.i18n.t(t.label))),
      ),
    ),
  );
}

let lastRoute: Route | null = null;

function render(): void {
  applyTheme();
  const c = ctx();
  // Prima di ridisegnare: cosa aveva il focus e dov'era lo scroll.
  const key = focusKey(appEl);
  const hadFocus = key !== null || (document.activeElement !== document.body && appEl.contains(document.activeElement));
  const prevScroll = window.scrollY;
  if (isWelcome()) {
    clear(appEl);
    const done = () => patchPrefs({ welcomed: true });
    // «Annulla» solo se c'è già qualcosa da conservare (si sta ripetendo la configurazione).
    appEl.append(h('div', { class: 'shell welcome-shell' }, h('main', { class: 'main' }, welcomeView(c, done, state.prefs.profiles.length ? done : undefined))));
    appEl.querySelector('h1')?.setAttribute('tabindex', '-1');
    const entering = !welcomeShown;
    welcomeShown = true;
    window.scrollTo(0, entering ? 0 : prevScroll);
    if (hadFocus && !restoreFocus(appEl, key)) appEl.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    syncUrl();
    return;
  }
  if (welcomeShown) {
    welcomeShown = false;
    lastRoute = null; // dalla schermata iniziale alla prima vista: in cima, focus sul titolo
  }
  const route = parseRoute();
  currentRoute = route;
  rememberStartView(route);
  let view: HTMLElement = undefined as unknown as HTMLElement;
  switch (route.name) {
    case 'day':
      view = dayView(ctx(), route.date, route.fromToday ? state.today : undefined);
      break;
    case 'family':
      view = familyView(ctx(), route.date, route.fromToday ? state.today : undefined);
      break;
    case 'calendar':
      view = calendarView(c, route.month);
      break;
    case 'stats':
      view = statsView(c, route.period);
      break;
    default:
      view = settingsView(c, route.add, route.calendar);
  }
  if (route.name === 'day' || route.name === 'family') {
    if (lastDay && lastDay !== route.date) view.classList.add(route.date > lastDay ? 'from-right' : 'from-left');
    lastDay = route.date;
  }
  clear(appEl);
  appEl.append(shell(route, view));
  appEl.querySelector('h1')?.setAttribute('tabindex', '-1');
  const changed = viewChanged(lastRoute, route);
  const enteringAdd = route.name === 'settings' && !!route.add && !(lastRoute?.name === 'settings' && lastRoute.add);
  const enteringCalendar = route.name === 'settings' && !!route.calendar && !(lastRoute?.name === 'settings' && lastRoute.calendar);
  lastRoute = route;
  // Altra vista (o altro giorno): in cima. Stessa vista (un'opzione, un periodo): scroll e focus restano dove sono.
  window.scrollTo(0, changed ? 0 : prevScroll);
  if (hadFocus && !restoreFocus(appEl, key)) {
    // Il controllo non c'è più (link di un'altra vista, avviso chiuso): il focus va al titolo o, se la vista è la stessa, al contenuto.
    (changed ? appEl.querySelector<HTMLElement>('h1') : document.getElementById('main'))?.focus({ preventScroll: true });
  }
  if (enteringAdd) {
    // Dalla scorciatoia «＋ Aggiungi»: il pannello è già aperto, in vista, col focus sul nome.
    document.getElementById('add-panel')?.scrollIntoView({ block: 'start' });
    appEl.querySelector<HTMLElement>('[data-fk="add-name"]')?.focus();
  }
  if (enteringCalendar) {
    // Da «Aggiungi al calendario» (Android, Windows…): la sezione in vista, istruzioni aperte, focus sul suo titolo.
    document.getElementById('calendar-section')?.scrollIntoView({ block: 'start' });
    document.getElementById('calendar-title')?.focus({ preventScroll: true });
  }
  setTitle(route);
  syncUrl();
  maybeShowMessage();
}

// --- titolo, annuncio ai lettori di schermo, indirizzo e manifest -----------------------------------------------

/** Ricorda se l'ultima vista del giorno era «Tutti»: il sito si riapre lì (solo localStorage, non nell'indirizzo). */
function rememberStartView(route: Route): void {
  if (route.name !== 'day' && route.name !== 'family') return;
  const family = route.name === 'family';
  if (state.prefs.startFamily === family) return;
  const prefs = { ...state.prefs, startFamily: family };
  savePrefs(prefs);
  state = { ...state, prefs };
}

function setTitle(route: Route): void {
  const { i18n } = state;
  const title =
    route.name === 'family'
      ? `${i18n.weekday(route.date)} ${i18n.dateLong(route.date)} · ${i18n.t('family_title')}`
      : route.name === 'day'
      ? `${i18n.weekday(route.date)} ${i18n.dateLong(route.date)}`
      : route.name === 'calendar'
        ? i18n.month(+route.month.slice(0, 4), +route.month.slice(5, 7) - 1)
        : route.name === 'stats'
          ? i18n.t('nav_stats')
          : i18n.t('nav_settings');
  document.title = `${title} · Scodella`;
  const live = document.getElementById('announcer');
  if (live && live.textContent !== title) live.textContent = title;
}

/**
 * Menu, profili e lingua nell'indirizzo (senza toccare `#…` né altri parametri) e nello `start_url` del manifest. I nomi dei bambini
 * vanno SOLO nello `start_url` (che resta sul dispositivo), mai nell'indirizzo visibile e quindi mai nei link da condividere.
 */
function syncUrl(): void {
  const { prefs } = state;
  const search = isWelcome()
    ? applyState(location.search, { menu: null, saved: [], lang: null })
    : applyState(location.search, {
        menu: activeMenuId(prefs),
        saved: prefs.profiles.map((p) => p.menuId),
        active: prefs.profiles.findIndex((p) => p.id === prefs.activeId),
        lang: prefs.lang,
      });
  if (search !== location.search) history.replaceState(null, '', `${location.pathname}${search}${location.hash}`);
  updateManifest(isWelcome() ? search : startSearch(search, prefs.profiles.map((p) => p.name)));
}

// --- messaggi del Comune ----------------------------------------------------------------------------------------

let messageOpen = false;
function maybeShowMessage(): void {
  if (messageOpen || isWelcome()) return;
  const msg = pickMessage(state.feed.messages, Date.now(), state.i18n.lang, new Set(state.prefs.dismissed));
  if (!msg) return;
  messageOpen = true;
  openSheet(msg.title || state.i18n.t('message_title_default'), [h('p', { class: 'message-body' }, msg.body)], state.i18n.t('ok'), () => {
    messageOpen = false;
    const prefs = { ...state.prefs, dismissed: [...state.prefs.dismissed, msg.version].slice(-50) };
    savePrefs(prefs);
    state = { ...state, prefs };
  });
}

// --- gesti e tastiera -------------------------------------------------------------------------------------------

/** Il tocco è partito da un controllo o da una zona che scorre in orizzontale (chip dei menu, campi): non è uno swipe tra giorni. */
/** Pagine che mostrano un giorno (la pagina del giorno e «Tutti»): ci si sposta tra i giorni con swipe e frecce. */
const isDayView = (r: Route) => r.name === 'day' || r.name === 'family';
const dayBase = (r: Route) => (r.name === 'family' ? '/family' : '');

function inNoSwipeZone(el: Element | null): boolean {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName) || n.hasAttribute('data-no-swipe')) return true;
    if (n.scrollWidth > n.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
  }
  return false;
}

function setupGestures(): void {
  let x = 0;
  let y = 0;
  let tracking = false;
  document.addEventListener(
    'touchstart',
    (e) => {
      tracking = e.touches.length === 1 && !document.querySelector('dialog[open]') && isDayView(parseRoute()) && !inNoSwipeZone(e.target as Element | null);
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - x;
      const dy = e.changedTouches[0].clientY - y;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 50 || Math.abs(dx) < Math.abs(dy) * 2) return;
      const r = parseRoute();
      if (r.name === 'day' || r.name === 'family') location.hash = `#${dayBase(r)}/${state.model.step(r.date, dx < 0 ? 1 : -1)}`;
    },
    { passive: true },
  );
  document.addEventListener('keydown', (e) => {
    // Dentro campi e zone che scorrono di lato (tabella «Tutti», chip) le frecce servono a loro, non a cambiare giorno.
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || document.querySelector('dialog[open]') || inNoSwipeZone(e.target as Element | null)) return;
    const r = parseRoute();
    if ((r.name !== 'day' && r.name !== 'family') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    location.hash = `#${dayBase(r)}/${state.model.step(r.date, e.key === 'ArrowRight' ? 1 : -1)}`;
  });
}

// --- aggiornamento del feed -------------------------------------------------------------------------------------

let lastRefresh = Date.now();
async function refreshFeed(): Promise<void> {
  if (!state || document.visibilityState !== 'visible' || !navigator.onLine) return;
  lastRefresh = Date.now();
  const today = currentToday();
  const { feed, ok } = await loadFeed(true);
  if (ok && feed.version !== state.feed.version) {
    // «Menu aggiornato» solo se prima c'era un feed: alla prima lettura riuscita (avvio offline) non è cambiato niente per l'utente.
    const hadFeed = state.feedOk;
    update({ feed, feedOk: true });
    if (hadFeed) toast(state.i18n.t('menu_changed_notice'));
  } else if (today !== state.today) {
    update({});
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 2 * 60_000) void refreshFeed();
});
window.setInterval(() => void refreshFeed(), 10 * 60_000);
window.addEventListener('online', () => {
  if (!state) return;
  render(); // via l'avviso «offline» anche se il feed non è cambiato
  void refreshFeed();
});
window.addEventListener('offline', () => state && render());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e as typeof deferredInstall;
  if (state && parseRoute().name === 'settings') render();
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  if (state) render();
});
window.addEventListener('hashchange', () => state && render());

// --- avvio ------------------------------------------------------------------------------------------------------

async function boot(): Promise<void> {
  let prefs = loadPrefs();
  const urlLang = parseState(location.search).lang;
  const lang = urlLang && LANGS.some((l) => l.code === urlLang) ? urlLang : (prefs.lang ?? detectLang());
  const [data, pack, fallback, feedResult] = await Promise.all([loadStatic(), loadPack(lang), loadPack('en'), loadFeed(true)]);
  prefs = mergeUrlState(prefs, data.menus.map((m) => m.id), location.search, isStandalone());
  savePrefs(prefs);
  state = build({ data, pack, fallback, feed: feedResult.feed, feedOk: feedResult.ok, prefs });
  const live = h('div', { id: 'announcer', class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  document.body.append(live);
  void initManifest().then(syncUrl);
  render();
  setupGestures();
  registerSW({ immediate: true });
  // Le lingue diverse da it/en non sono nel precache: alla prima visita il pack si è scaricato prima che il service worker
  // controllasse la pagina, quindi lo si richiede una volta attraverso di lui perché resti disponibile offline.
  navigator.serviceWorker?.addEventListener('controllerchange', () => void loadPack(state.i18n.lang), { once: true });
}

boot().catch((e) => {
  console.error(e);
  const i18n = new I18n(detectLang(), EMPTY_PACK, EMPTY_PACK);
  clear(appEl);
  appEl.append(
    h(
      'div',
      { class: 'boot-error', role: 'alert' },
      h('p', null, i18n.t('load_error')),
      h('button', { class: 'btn primary', onclick: () => location.reload() }, i18n.t('retry')),
      h('button', { class: 'btn text', onclick: () => { resetPrefs(); location.href = location.pathname; } }, i18n.t('reset_settings')),
    ),
  );
});

