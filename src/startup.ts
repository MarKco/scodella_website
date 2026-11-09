// All'avvio le preferenze salvate si uniscono a ciò che dice l'indirizzo. Funzione pura (testata): main.ts passa i dati veri.
import { LANGS } from './i18n';
import { MAX_PROFILES, addProfile, normalizeProfiles, setActive, setProfiles, type Prefs } from './prefs';
import { parseState } from './urlstate';

/**
 * Un indirizzo con `?menu=…` (link condiviso, icona Home) fa saltare il benvenuto:
 * - senza profili salvati (altro dispositivo, app installata su iPhone dove lo storage di Safari non c'è) i profili nascono dall'indirizzo,
 *   coi nomi che portava lo `start_url` dell'icona Home (e solo quello);
 * - con profili già salvati, **in una scheda del browser** l'indirizzo sceglie il menu attivo (aggiungendolo se manca e c'è posto);
 * - **nell'app installata** (`standalone`) con profili già salvati comanda lo storage: lo `start_url` è quello di quando si è aggiunta
 *   l'icona e rimetterebbe attivo, a ogni avvio, il profilo di allora.
 */
export function mergeUrlState(prefs: Prefs, menuIds: string[], search: string, standalone: boolean): Prefs {
  const url = parseState(search);
  const exists = (id: string) => menuIds.includes(id);
  let p = normalizeProfiles(prefs, exists);
  const lang = url.lang && LANGS.some((l) => l.code === url.lang) ? url.lang : null;
  const menus = (url.saved.length ? url.saved : url.menu ? [url.menu] : []).filter(exists).slice(0, MAX_PROFILES);

  if (p.profiles.length > 0 && standalone) return menus.length ? { ...p, welcomed: true } : p;
  if (lang) p = { ...p, lang };
  if (menus.length === 0) return p;

  if (p.profiles.length === 0) {
    p = setProfiles(p, menus.map((menuId, i) => ({ menuId, name: url.names[i] ?? '' })));
    const wanted = url.active !== undefined ? p.profiles[url.active] : p.profiles.find((x) => x.menuId === url.menu);
    if (wanted) p = setActive(p, wanted.id);
  } else {
    const target = url.menu && exists(url.menu) ? url.menu : menus[0];
    // Stessa lista di menu nello stesso ordine: vale l'indice `p` (distingue due profili con lo stesso menu).
    const sameList = url.active !== undefined && url.saved.length === p.profiles.length && url.saved.every((m, i) => m === p.profiles[i].menuId);
    const have = sameList ? p.profiles[url.active!] : p.profiles.find((x) => x.menuId === target);
    p = have ? setActive(p, have.id) : addProfile(p, { menuId: target });
  }
  return { ...p, welcomed: true };
}
