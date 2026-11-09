import type { LangPack, UiString } from './domain/types';
import { EMPTY_PACK } from './domain/types';

export interface LangInfo {
  code: string;
  native: string;
  locale: string;
}

export const LANGS: LangInfo[] = [
  { code: 'it', native: 'Italiano', locale: 'it-IT' },
  { code: 'en', native: 'English', locale: 'en-GB' },
  { code: 'hi', native: 'हिन्दी', locale: 'hi-IN' },
  { code: 'bn', native: 'বাংলা', locale: 'bn-IN' },
  { code: 'te', native: 'తెలుగు', locale: 'te-IN' },
  { code: 'ta', native: 'தமிழ்', locale: 'ta-IN' },
  { code: 'mr', native: 'मराठी', locale: 'mr-IN' },
];

export const localeOf = (lang: string) => LANGS.find((l) => l.code === lang)?.locale ?? 'it-IT';

/** La lingua del browser se la conosciamo, altrimenti l'italiano. */
export function detectLang(): string {
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.toLowerCase().split('-')[0];
    if (LANGS.some((x) => x.code === code)) return code;
  }
  return 'it';
}

// Testi propri del sito (l'app Android non li ha). Italiano e inglese qui; le altre lingue sono in public/data/extra/<lingua>.json
// (fuori da lang/, che sync-from-app.mjs riscrive) e arrivano dentro pack.ui tramite loadPack.
export const EXTRA: Record<'it' | 'en', Record<string, string>> = {
  it: {
    family_all: 'Tutti',
    family_title: 'Tutti i menu',
    family_caption: 'Menu del %1$s di ogni bambino',
    family_course: 'Portata',
    family_different: 'diverso',
    family_diff_only: 'Solo le differenze',
    family_summary: '%1$s portate su %2$s sono diverse',
    family_summary_one: '1 portata su %2$s è diversa',
    family_same: 'I menu sono uguali per tutti: nessuna differenza.',
    family_none: 'Nessun menu',
    family_scroll: 'Scorri di lato per vedere gli altri bambini',
    family_moved: 'Si serve il menu di un altro giorno',
    menu_change_short: 'Cambia',
    menu_close_short: 'Chiudi',
    add_confirm: 'Aggiungi',
    profile_new_title: 'Nuovo menu',
    profile_added: 'Menu aggiunto',
    profile_removed: 'Menu rimosso',
    welcome_redo: 'Ripeti la configurazione iniziale',
    welcome_redo_hint: 'Scegli di nuovo lingua, bambini e menu. Quelli attuali restano finché non confermi.',
    child_n: 'Bambino %1$s',
    profile_name: 'Nome (facoltativo)',
    profile_name_placeholder: 'es. Anna',
    profile_name_hint: 'Il nome resta solo su questo dispositivo: non finisce mai in un link.',
    profile_add_child: '＋ Aggiungi un altro bambino',
    profile_remove: 'Rimuovi',
    profile_use: 'Usa questo',
    profile_active: 'In uso',
    profile_menu: 'Menu',
    profile_menu_change: 'Cambia menu',
    profile_max: 'Puoi seguire al massimo %1$s menu.',
    welcome_multi_hint: 'Segui il menu di più bambini? Aggiungili qui sotto: fino a %1$s, anche con lo stesso menu.',
    home_add: '＋ Aggiungi',
    home_add_more: ' un altro menu o un altro bambino',
    home_hide_label: 'Nascondi il suggerimento «Aggiungi»',
    home_edit: 'cambia menu',
    skip_to_content: 'Vai al contenuto',
    reset_settings: 'Ripristina le impostazioni',
    sim_note: 'Data simulata: la pagina fa come se oggi fosse %1$s.',
    sim_back: 'Torna alla data reale',
    today_closed: 'Oggi, %1$s: niente mensa (%2$s). Ecco %3$s.',
    reason_weekend: 'fine settimana',
    reason_not_started: 'la mensa non è ancora iniziata',
    reason_ended: 'menu terminato',
    reason_generic: 'nessun menu',
    varied_tag: 'variato',
    varied_one: '1 variazione',
    varied_many: '%1$s variazioni',
    my_menus: 'I miei menu',
    my_menus_hint: 'Puoi seguirne fino a %1$s (per esempio per più figli, anche con lo stesso menu) e passare dall’uno all’altro con un tocco.',
    menu_remove: 'Rimuovi',
    menu_add: '＋ Aggiungi un altro menu',
    menu_change_title: 'Cambia il menu attivo',
    menu_add_title: 'Aggiungi un menu',
    menu_cancel: 'Annulla',
    share_link: 'Copia il link con la mia scelta',
    share_link_copied: 'Link copiato',
    share_link_hint: 'Chi lo apre vede lo stesso menu e la stessa lingua.',
    cal_title: 'Calendario',
    cal_text: 'Ricevi il menu di ogni giorno nel calendario del telefono. Le variazioni si aggiornano da sole e nei giorni variati puoi avere un avviso alle 7:00.',
    cal_button: 'Aggiungi al calendario',
    cal_short: 'Calendario',
    cal_address: 'Indirizzo del calendario',
    cal_copy: 'Copia',
    cal_copied: 'Indirizzo copiato',
    cal_more: 'Altri modi e istruzioni',
    cal_iphone: 'iPhone e iPad',
    cal_iphone_text: 'Tocca «Aggiungi al calendario» e conferma con «Iscriviti». Per ricevere l’avviso delle 7:00 nei giorni variati, nelle impostazioni del calendario sottoscritto disattiva «Rimuovi avvisi».',
    cal_google: 'Android e Google Calendar',
    cal_google_text: 'Da computer apri Google Calendar → Altri calendari → + → Da URL e incolla l’indirizzo. Google aggiorna i calendari sottoscritti con calma (anche dopo 24 ore) e non mostra gli avvisi.',
    cal_outlook: 'Outlook',
    cal_outlook_text: 'In Outlook web: Aggiungi calendario → Sottoscrivi dal Web, incolla l’indirizzo e salva.',
    report_error: 'Segnala un errore',
    report_day: 'Segnala un errore in questo giorno',
    source_code: 'Codice sorgente',
    version_label: 'Versione',
    menu_label: 'Menu',
    stats_days_label: 'Giorni con variazioni',
    stats_of: 'su',
    stats_deleted_label: 'Piatti non serviti',
    play_badge_alt: 'Disponibile su Google Play',
    play_banner_text: 'Scodella è disponibile anche come app Android',
    play_banner_close: 'Chiudi l’avviso',
    play_settings_title: 'App Android',
    play_settings_text: "L'app per Android ha il widget del menu di oggi e le notifiche quando il Comune pubblica una variazione.",
    week_title: 'La settimana',
    sidebar_nav: 'Navigazione principale',
    sidebar_unofficial: 'Sito non ufficiale del Comune di Venezia',
    theme_cycle: 'Cambia tema',
    month_nav: 'Mese',
    nav_day: 'Giorno',
    nav_calendar: 'Calendario',
    nav_stats: 'Variazioni',
    nav_settings: 'Impostazioni',
    loading: 'Caricamento…',
    load_error: 'Non riesco a caricare i dati. Controlla la connessione e riprova.',
    retry: 'Riprova',
    prev_day: 'Giorno precedente',
    next_day: 'Giorno successivo',
    prev_month: 'Mese precedente',
    next_month: 'Mese successivo',
    share: 'Condividi',
    share_copied: 'Link copiato',
    ok: 'OK',
    close: 'Chiudi',
    offline: 'Sei offline: i dati potrebbero non essere aggiornati.',
    feed_updated: 'Variazioni aggiornate al %1$s',
    feed_none: 'Nessuna variazione ancora letta',
    feed_hint: "Variazioni, chiusure e messaggi del Comune arrivano da soli, di solito entro un'ora.",
    theme: 'Tema',
    theme_system: 'Come il dispositivo',
    theme_light: 'Chiaro',
    theme_dark: 'Scuro',
    install_title: 'Installa come app',
    install_hint: "Aggiungi Scodella alla schermata Home: si apre a schermo intero e funziona anche offline.",
    install_button: 'Installa',
    install_ios: 'Su iPhone e iPad: tocca Condividi, poi «Aggiungi alla schermata Home».',
    install_done: 'Già installata',
    calendar_variation: 'Variazione del Comune',
    calendar_closed: 'Niente mensa',
    legend_changed: 'variazione',
    legend_closed: 'chiuso',
    info_unofficial: 'Non è un sito ufficiale del Comune di Venezia.',
    info_app: 'App Android',
    info_data: 'Dati',
    info_data_text: 'Menu del Comune di Venezia, Ristorazione scolastica. Le variazioni sono pubblicate dall’autore.',
    info_privacy_web: 'Privacy',
    info_privacy_web_text: 'Questo sito non usa cookie né strumenti di analisi: la scelta del menu e della lingua resta solo nel tuo browser.',
    dish_ingredients_none: 'Ingredienti non disponibili per questo piatto',
    dish_variation_note: 'Variazione comunicata il %1$s',
    dish_menu_hint: 'Menu',
    day_outside: 'Fuori dal periodo del menu',
    stats_period_label: 'Periodo',
    stats_weekday: 'Per giorno della settimana',
    stats_deleted: 'piatti non serviti',
    stats_empty_web: 'Nessuna variazione in questo periodo.',
    stats_hint: 'Cosa ha cambiato la mensa rispetto al menu del PDF, nel periodo scelto.',
    welcome_language: 'Lingua',
    menu_changed_notice: 'Menu aggiornato',
    weekday_short: 'Giorno',
    message_title_default: 'Avviso',
    go_next_menu_day: 'Vai al prossimo giorno di mensa',
    swipe_hint: 'Scorri per cambiare giorno',
  },
  en: {
    family_all: 'All',
    family_title: 'All menus',
    family_caption: 'Menu of %1$s for each child',
    family_course: 'Course',
    family_different: 'different',
    family_diff_only: 'Only the differences',
    family_summary: '%1$s of %2$s courses are different',
    family_summary_one: '1 of %2$s courses is different',
    family_same: 'The menus are the same for everyone: no differences.',
    family_none: 'No menu',
    family_scroll: 'Scroll sideways to see the other children',
    family_moved: 'The menu of another day is served',
    menu_change_short: 'Change',
    menu_close_short: 'Close',
    add_confirm: 'Add',
    profile_new_title: 'New menu',
    profile_added: 'Menu added',
    profile_removed: 'Menu removed',
    welcome_redo: 'Repeat the initial setup',
    welcome_redo_hint: 'Choose language, children and menus again. The current ones stay until you confirm.',
    child_n: 'Child %1$s',
    profile_name: 'Name (optional)',
    profile_name_placeholder: 'e.g. Emma',
    profile_name_hint: 'The name stays on this device only: it never ends up in a link.',
    profile_add_child: '＋ Add another child',
    profile_remove: 'Remove',
    profile_use: 'Use this one',
    profile_active: 'In use',
    profile_menu: 'Menu',
    profile_menu_change: 'Change menu',
    profile_max: 'You can follow at most %1$s menus.',
    welcome_multi_hint: 'Following more than one child’s menu? Add them below: up to %1$s, even with the same menu.',
    home_add: '＋ Add',
    home_add_more: ' another menu or child',
    home_hide_label: 'Hide the “Add” suggestion',
    home_edit: 'change menu',
    skip_to_content: 'Skip to content',
    reset_settings: 'Reset settings',
    sim_note: 'Simulated date: the page behaves as if today were %1$s.',
    sim_back: 'Back to the real date',
    today_closed: 'Today, %1$s: no canteen (%2$s). Here is %3$s.',
    reason_weekend: 'weekend',
    reason_not_started: 'the canteen has not started yet',
    reason_ended: 'menu ended',
    reason_generic: 'no menu',
    varied_tag: 'changed',
    varied_one: '1 change',
    varied_many: '%1$s changes',
    my_menus: 'My menus',
    my_menus_hint: 'You can follow up to %1$s (for example for several children, even with the same menu) and switch between them with a tap.',
    menu_remove: 'Remove',
    menu_add: '＋ Add another menu',
    menu_change_title: 'Change the active menu',
    menu_add_title: 'Add a menu',
    menu_cancel: 'Cancel',
    share_link: 'Copy the link with my choice',
    share_link_copied: 'Link copied',
    share_link_hint: 'Whoever opens it sees the same menu and language.',
    cal_title: 'Calendar',
    cal_text: 'Get each day’s menu in your phone’s calendar. Changes update on their own, and on changed days you can get a 7:00 alert.',
    cal_button: 'Add to calendar',
    cal_short: 'Calendar',
    cal_address: 'Calendar address',
    cal_copy: 'Copy',
    cal_copied: 'Address copied',
    cal_more: 'Other ways and instructions',
    cal_iphone: 'iPhone and iPad',
    cal_iphone_text: 'Tap “Add to calendar” and confirm with “Subscribe”. To get the 7:00 alert on changed days, turn off “Remove alerts” in the subscribed calendar’s settings.',
    cal_google: 'Android and Google Calendar',
    cal_google_text: 'On a computer open Google Calendar → Other calendars → + → From URL and paste the address. Google refreshes subscribed calendars slowly (even after 24 hours) and does not show their alerts.',
    cal_outlook: 'Outlook',
    cal_outlook_text: 'In Outlook web: Add calendar → Subscribe from web, paste the address and save.',
    report_error: 'Report a mistake',
    report_day: 'Report a mistake on this day',
    source_code: 'Source code',
    version_label: 'Version',
    menu_label: 'Menu',
    stats_days_label: 'Days with changes',
    stats_of: 'of',
    stats_deleted_label: 'Dishes not served',
    play_badge_alt: 'Get it on Google Play',
    play_banner_text: 'Scodella is also available as an Android app',
    play_banner_close: 'Dismiss',
    play_settings_title: 'Android app',
    play_settings_text: "The Android app has a today's-menu widget and notifies you when the municipality publishes a change.",
    week_title: 'This week',
    sidebar_nav: 'Main navigation',
    sidebar_unofficial: 'Not an official website of the Comune di Venezia',
    theme_cycle: 'Change theme',
    month_nav: 'Month',
    nav_day: 'Day',
    nav_calendar: 'Calendar',
    nav_stats: 'Changes',
    nav_settings: 'Settings',
    loading: 'Loading…',
    load_error: "Can't load the data. Check your connection and try again.",
    retry: 'Retry',
    prev_day: 'Previous day',
    next_day: 'Next day',
    prev_month: 'Previous month',
    next_month: 'Next month',
    share: 'Share',
    share_copied: 'Link copied',
    ok: 'OK',
    close: 'Close',
    offline: 'You are offline: data may be out of date.',
    feed_updated: 'Changes updated on %1$s',
    feed_none: 'No changes read yet',
    feed_hint: 'Changes, closures and notices from the municipality arrive on their own, usually within an hour.',
    theme: 'Theme',
    theme_system: 'Same as device',
    theme_light: 'Light',
    theme_dark: 'Dark',
    install_title: 'Install as an app',
    install_hint: 'Add Scodella to your Home screen: it opens full-screen and works offline too.',
    install_button: 'Install',
    install_ios: 'On iPhone and iPad: tap Share, then “Add to Home Screen”.',
    install_done: 'Already installed',
    calendar_variation: 'Change from the municipality',
    calendar_closed: 'No canteen',
    legend_changed: 'change',
    legend_closed: 'closed',
    info_unofficial: 'This is not an official website of the Comune di Venezia.',
    info_app: 'Android app',
    info_data: 'Data',
    info_data_text: 'Menus from the Comune di Venezia school catering service. Changes are published by the author.',
    info_privacy_web: 'Privacy',
    info_privacy_web_text: 'This site uses no cookies or analytics: your menu and language choices stay in your browser only.',
    dish_ingredients_none: 'Ingredients not available for this dish',
    dish_variation_note: 'Change announced on %1$s',
    dish_menu_hint: 'Menu',
    day_outside: 'Outside the menu period',
    stats_period_label: 'Period',
    stats_weekday: 'By day of the week',
    stats_deleted: 'dishes not served',
    stats_empty_web: 'No changes in this period.',
    stats_hint: "What the canteen changed compared with the menu in the PDF, over the chosen period.",
    welcome_language: 'Language',
    menu_changed_notice: 'Menu updated',
    weekday_short: 'Day',
    message_title_default: 'Notice',
    go_next_menu_day: 'Go to the next canteen day',
    swipe_hint: 'Swipe to change day',
  },
};

export class I18n {
  constructor(
    readonly lang: string,
    readonly pack: LangPack,
    private readonly fallback: LangPack,
  ) {}

  get locale(): string {
    return localeOf(this.lang);
  }

  private raw(key: string): UiString | undefined {
    return this.pack.ui[key] ?? this.fallback.ui[key] ?? EXTRA[this.lang as 'it' | 'en']?.[key] ?? EXTRA.en[key];
  }

  /** Stringa con segnaposto `%1$s`, `%2$s`. Una chiave mancante si vede come tale (utile in sviluppo). */
  t(key: string, ...args: (string | number)[]): string {
    let s = this.raw(key);
    if (typeof s === 'object') s = s.other ?? Object.values(s)[0];
    if (s == null) return key;
    return s.replace(/%(\d)\$s/g, (_, i) => String(args[Number(i) - 1] ?? ''));
  }

  /** Plurale: sceglie la forma con Intl.PluralRules (one/other/…); ripiega su `other`. */
  plural(key: string, n: number, ...args: (string | number)[]): string {
    const s = this.raw(key);
    if (typeof s === 'string') return this.t(key, n, ...args);
    if (!s) return key;
    const form = new Intl.PluralRules(this.locale).select(n);
    return (s[form] ?? s.other ?? Object.values(s)[0]).replace(/%(\d)\$s/g, (_, i) => String([n, ...args][Number(i) - 1] ?? ''));
  }

  weekday(iso: string, style: 'long' | 'short' | 'narrow' = 'long'): string {
    return new Intl.DateTimeFormat(this.locale, { weekday: style, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  }
  dateLong(iso: string): string {
    return new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  }
  dateShort(iso: string): string {
    return new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  }
  month(year: number, month0: number): string {
    return new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month0, 1)));
  }
  dateTime(ms: number): string {
    return new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  }
  number(n: number): string {
    return new Intl.NumberFormat(this.locale).format(n);
  }
}

export const emptyI18n = (lang = 'it') => new I18n(lang, EMPTY_PACK, EMPTY_PACK);
