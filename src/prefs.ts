// Preferenze dell'utente: solo nel suo browser (localStorage), mai inviate da nessuna parte.
// I nomi dei bambini sono dati personali di minori: stanno qui e basta. Non entrano mai in un indirizzo condivisibile
// (vedi urlstate.ts; l'unica eccezione, lo `start_url` dell'icona Home, resta sul dispositivo: vedi manifest.ts).
import type { Food } from './domain/content';
import { LANGS } from './i18n';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Quanti profili (bambini / menu) si possono seguire. */
export const MAX_PROFILES = 5;
export const NAME_MAX = 24;

/** Un profilo: chi segue quale menu. Il nome è facoltativo (senza nome si usa quello del menu); lo stesso menu può comparire in più profili. */
export interface Profile {
  id: string;
  name: string;
  menuId: string;
}

export interface Prefs {
  profiles: Profile[];
  /** Profilo attivo (`id`); `null` solo prima della scelta iniziale. */
  activeId: string | null;
  lang: string | null;
  theme: ThemeChoice;
  foods: Food[];
  welcomed: boolean;
  dismissed: string[];
  iosHintDismissed: boolean;
  playBannerDismissed: boolean;
  /** Nascosto con la X il suggerimento «＋ Aggiungi» nella riga in cima. */
  profileHintDismissed: boolean;
  /** L'ultima vista del giorno era «Tutti»: il sito si riapre lì (con almeno 2 bambini). */
  startFamily: boolean;
  /** In «Tutti» si mostrano solo le portate in cui i bambini hanno piatti diversi. */
  familyDiffOnly: boolean;
}

const KEY = 'scodella.prefs.v1';
const DEFAULTS: Prefs = {
  profiles: [],
  activeId: null,
  lang: null,
  theme: 'system',
  foods: [],
  welcomed: false,
  dismissed: [],
  iosHintDismissed: false,
  playBannerDismissed: false,
  profileHintDismissed: false,
  startFamily: false,
  familyDiffOnly: false,
};

// --- nomi ------------------------------------------------------------------------------------------------------------

/** Un nome inserito dall'utente: senza caratteri di controllo né `|` (separatore), spazi ripuliti, al massimo `NAME_MAX` caratteri. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001F\u007F|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

/**
 * Le etichette dei profili: il nome, o quello del menu se manca. Se due profili avrebbero la stessa etichetta (due bambini senza nome
 * con lo stesso menu) dal secondo in poi si aggiunge « (2)», « (3)».
 */
export function profileLabels(profiles: Profile[], menuTitle: (menuId: string) => string): Map<string, string> {
  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const p of profiles) {
    const base = p.name || menuTitle(p.menuId);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    labels.set(p.id, n === 1 ? base : `${base} (${n})`);
  }
  return labels;
}

// --- operazioni sui profili (pure, testate) ----------------------------------------------------------------------------

export const activeProfile = (p: Prefs): Profile | null => p.profiles.find((x) => x.id === p.activeId) ?? p.profiles[0] ?? null;
export const activeMenuId = (p: Prefs): string | null => activeProfile(p)?.menuId ?? null;

function nextId(profiles: Profile[]): string {
  for (let i = 1; i <= MAX_PROFILES + 1; i++) if (!profiles.some((x) => x.id === `p${i}`)) return `p${i}`;
  return `p${profiles.length + 1}`;
}

/** Coerenza: id unici, al massimo `MAX_PROFILES`, solo menu che esistono, profilo attivo sempre dentro. */
export function normalizeProfiles(p: Prefs, exists: (menuId: string) => boolean = () => true): Prefs {
  const profiles: Profile[] = [];
  for (const x of p.profiles) {
    if (profiles.length >= MAX_PROFILES || !exists(x.menuId)) continue;
    profiles.push({ id: profiles.some((y) => y.id === x.id) ? nextId(profiles) : x.id, name: cleanName(x.name), menuId: x.menuId });
  }
  const activeId = profiles.some((x) => x.id === p.activeId) ? p.activeId : (profiles[0]?.id ?? null);
  return { ...p, profiles, activeId };
}

/** Nuovo profilo (se c'è posto), che diventa l'attivo. */
export function addProfile(p: Prefs, init: { menuId: string; name?: string }): Prefs {
  if (p.profiles.length >= MAX_PROFILES) return p;
  const profile: Profile = { id: nextId(p.profiles), name: cleanName(init.name), menuId: init.menuId };
  return { ...p, profiles: [...p.profiles, profile], activeId: profile.id };
}

export function updateProfile(p: Prefs, id: string, patch: { name?: string; menuId?: string }): Prefs {
  if (!p.profiles.some((x) => x.id === id)) return p;
  return {
    ...p,
    profiles: p.profiles.map((x) => (x.id === id ? { ...x, ...(patch.name !== undefined ? { name: cleanName(patch.name) } : {}), ...(patch.menuId ? { menuId: patch.menuId } : {}) } : x)),
  };
}

export function setActive(p: Prefs, id: string): Prefs {
  return p.profiles.some((x) => x.id === id) ? { ...p, activeId: id } : p;
}

/** Toglie un profilo (ne resta sempre almeno uno); se era l'attivo, diventa attivo il primo rimasto. */
export function removeProfile(p: Prefs, id: string): Prefs {
  if (p.profiles.length <= 1 || !p.profiles.some((x) => x.id === id)) return p;
  const profiles = p.profiles.filter((x) => x.id !== id);
  return { ...p, profiles, activeId: p.activeId === id ? profiles[0].id : p.activeId };
}

/** Sostituisce tutti i profili (scelta iniziale): il primo è l'attivo. */
export function setProfiles(p: Prefs, list: { name?: string; menuId: string }[]): Prefs {
  let next: Prefs = { ...p, profiles: [], activeId: null };
  for (const x of list.slice(0, MAX_PROFILES)) {
    const profile: Profile = { id: nextId(next.profiles), name: cleanName(x.name), menuId: x.menuId };
    next = { ...next, profiles: [...next.profiles, profile] };
  }
  return { ...next, activeId: next.profiles[0]?.id ?? null };
}

// --- caricamento e validazione ----------------------------------------------------------------------------------------

const THEME_VALUES: ThemeChoice[] = ['system', 'light', 'dark'];
const FOOD_VALUES = ['EGGS', 'MEAT', 'FISH'];
const MENU_ID = /^[a-z0-9][a-z0-9-]{0,80}$/i;
const PROFILE_ID = /^p[1-9]\d?$/;
const menuId = (v: unknown): string | null => (typeof v === 'string' && MENU_ID.test(v) ? v : null);

/**
 * Qualunque cosa ci sia nello storage (versioni vecchie, estensioni, modifiche a mano) diventa preferenze valide: mai un'eccezione.
 * Migra il formato precedente (`menus` + `menuId`, senza nomi).
 */
export function sanitizePrefs(raw: unknown): Prefs {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const list = (v: unknown) => (Array.isArray(v) ? v : []);

  let profiles: Profile[] = [];
  let activeId: string | null = typeof r.activeId === 'string' && PROFILE_ID.test(r.activeId) ? r.activeId : null;
  if (Array.isArray(r.profiles)) {
    for (const x of r.profiles) {
      const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
      const m = menuId(o.menuId);
      if (m) profiles.push({ id: typeof o.id === 'string' && PROFILE_ID.test(o.id) ? o.id : nextId(profiles), name: cleanName(o.name), menuId: m });
    }
  } else {
    // Formato precedente: elenco di menu salvati e menu attivo.
    const old = list(r.menus).map(menuId).filter((x): x is string => !!x);
    const current = menuId(r.menuId);
    if (current && !old.includes(current)) old.unshift(current);
    profiles = old.map((m, i) => ({ id: `p${i + 1}`, name: '', menuId: m }));
    activeId = profiles.find((x) => x.menuId === current)?.id ?? null;
  }

  return normalizeProfiles({
    profiles,
    activeId,
    lang: typeof r.lang === 'string' && LANGS.some((l) => l.code === r.lang) ? r.lang : null,
    theme: THEME_VALUES.includes(r.theme as ThemeChoice) ? (r.theme as ThemeChoice) : 'system',
    foods: list(r.foods).filter((f): f is Food => FOOD_VALUES.includes(f as string)),
    welcomed: r.welcomed === true,
    dismissed: list(r.dismissed).filter((x): x is string => typeof x === 'string' && x.length < 200).slice(-50),
    iosHintDismissed: r.iosHintDismissed === true,
    playBannerDismissed: r.playBannerDismissed === true,
    profileHintDismissed: r.profileHintDismissed === true,
    startFamily: r.startFamily === true,
    familyDiffOnly: r.familyDiffOnly === true,
  });
}

export function resetPrefs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage bloccato: niente da ripristinare */
  }
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitizePrefs(JSON.parse(raw));
  } catch {
    /* storage bloccato o rovinato: si riparte dai default */
  }
  return { ...DEFAULTS };
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* modalità privata: le preferenze durano finché la pagina è aperta */
  }
}
