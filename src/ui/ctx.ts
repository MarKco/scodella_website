import type { DishEntry } from '../domain/content';
import type { ISODate } from '../domain/dates';
import type { Model } from '../domain/model';
import type { I18n } from '../i18n';
import type { Prefs } from '../prefs';

/** Tutto ciò che le viste leggono o possono chiedere all'app. */
export interface Ctx {
  model: Model;
  /** Il modello di un altro menu (per le colonne della vista «Tutti»); per il menu in uso è `model`. */
  modelFor(menuId: string): Model;
  /** La vista è «Tutti i menu». */
  isFamily: boolean;
  /** Il giorno mostrato (pagina del giorno o «Tutti»), `null` nelle altre viste. */
  viewDate: ISODate | null;
  i18n: I18n;
  prefs: Prefs;
  /** `true` se il feed delle variazioni è stato letto almeno una volta. */
  feedOk: boolean;
  today: ISODate;
  go(path: string): void;
  patch(p: Partial<Prefs>): void;
  /** Ridisegna la pagina senza cambiare le preferenze (bozze locali delle viste: schermata iniziale, pannello «Nuovo menu»). */
  rerender(): void;
  /** Profili (bambino + menu, fino a `MAX_PROFILES`). I nomi restano solo sul dispositivo. */
  setActiveProfile(id: string): void;
  addProfile(init: { menuId: string; name?: string }): void;
  updateProfile(id: string, patch: { name?: string; menuId?: string }): void;
  removeProfile(id: string): void;
  /** Scelta iniziale: sostituisce tutti i profili (il primo diventa l'attivo). */
  setProfiles(list: { name?: string; menuId: string }[]): void;
  /** Riapre la schermata iniziale (precompilata con i profili attuali, che restano finché non si conferma). */
  restartWelcome(): void;
  setLang(code: string): Promise<void>;
  /** `menuId`: il menu a cui appartiene il piatto (nella vista «Tutti» ogni colonna ha il suo). */
  openDish(entry: DishEntry, date: ISODate, menuId?: string): void;
  toast(message: string): void;
  install: { available: boolean; installed: boolean; ios: boolean; prompt(): Promise<void> };
}
