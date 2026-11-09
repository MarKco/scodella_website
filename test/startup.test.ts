import { describe, expect, it } from 'vitest';
import { addProfile, sanitizePrefs, setActive, setProfiles, type Prefs } from '../src/prefs';
import { mergeUrlState } from '../src/startup';

const MENUS = ['base', 'senza-carne', 'senza-latte'];
const empty = sanitizePrefs(null);
const local = (...menus: string[]): Prefs => ({ ...setProfiles(empty, menus.map((menuId, i) => ({ menuId, name: `N${i + 1}` }))), welcomed: true });
const merge = (p: Prefs, search: string, standalone = false) => mergeUrlState(p, MENUS, search, standalone);
const menusOf = (p: Prefs) => p.profiles.map((x) => x.menuId);

describe('avvio: preferenze + indirizzo', () => {
  it('senza indirizzo non cambia nulla', () => {
    const p = local('base', 'senza-carne');
    expect(merge(p, '')).toEqual(p);
    expect(merge(empty, '').welcomed).toBe(false);
  });
  it('storage vuoto (altro dispositivo, icona Home): i profili nascono dall\'indirizzo, coi nomi dello start_url, e il benvenuto salta', () => {
    const p = merge(empty, '?menu=senza-carne&saved=base|senza-carne&p=2&names=Giulia|Marco');
    expect(p.welcomed).toBe(true);
    expect(p.profiles.map((x) => [x.name, x.menuId])).toEqual([['Giulia', 'base'], ['Marco', 'senza-carne']]);
    expect(p.activeId).toBe('p2');
  });
  it('lo stesso menu due volte: vale l\'indice p', () => {
    const p = merge(empty, '?menu=base&saved=base|base&p=2&names=A|B');
    expect(p.profiles.map((x) => x.name)).toEqual(['A', 'B']);
    expect(p.activeId).toBe('p2');
  });
  it('indirizzo della prima versione (solo menu, senza p)', () => {
    const p = merge(empty, '?menu=senza-latte');
    expect(menusOf(p)).toEqual(['senza-latte']);
    expect(p.welcomed).toBe(true);
  });
  it('menu inesistenti o strani si ignorano', () => {
    expect(merge(empty, '?menu=zzz&saved=zzz|yyy')).toEqual(empty);
    expect(menusOf(merge(empty, '?saved=base|zzz|senza-carne'))).toEqual(['base', 'senza-carne']);
  });
  it('in una scheda del browser, con profili già salvati, l\'indirizzo sceglie il menu attivo (e non perde i nomi)', () => {
    const p = merge(local('base', 'senza-carne'), '?menu=senza-carne');
    expect(p.activeId).toBe('p2');
    expect(p.profiles.map((x) => x.name)).toEqual(['N1', 'N2']);
  });
  it('un menu che manca si aggiunge (se c\'è posto) e diventa attivo; con la lista già completa non cambia nulla', () => {
    const p = merge(local('base'), '?menu=senza-latte');
    expect(menusOf(p)).toEqual(['base', 'senza-latte']);
    expect(p.activeId).toBe('p2');
    const full = merge(local('base', 'senza-carne', 'senza-latte'), '?menu=senza-latte&saved=base|senza-carne|senza-latte&p=3');
    expect(menusOf(full)).toEqual(['base', 'senza-carne', 'senza-latte']);
    expect(full.activeId).toBe('p3');
  });
  it('con la stessa lista vale p, anche per due profili con lo stesso menu', () => {
    const base = local('base', 'base');
    expect(merge(base, '?menu=base&saved=base|base&p=2').activeId).toBe('p2');
    expect(merge(base, '?menu=base&saved=base|base&p=1').activeId).toBe('p1');
  });
  it('NELL\'APP INSTALLATA con profili già salvati comanda lo storage: lo start_url non rimette attivo il profilo di quando si è aggiunta l\'icona', () => {
    const p = setActive(local('base', 'senza-carne'), 'p2');
    const launched = merge(p, '?menu=base&saved=base|senza-carne&p=1&names=Giulia|Marco', true);
    expect(launched.activeId).toBe('p2');
    expect(launched.profiles.map((x) => x.name)).toEqual(['N1', 'N2']); // e i nomi dello start_url non sovrascrivono quelli attuali
    expect(launched.welcomed).toBe(true);
  });
  it('nell\'app installata con lo storage vuoto (primo avvio) i profili nascono dall\'indirizzo', () => {
    expect(merge(empty, '?menu=base&saved=base|senza-carne&p=2&names=Giulia|Marco', true).profiles.map((x) => x.name)).toEqual(['Giulia', 'Marco']);
  });
  it('la lingua dell\'indirizzo si applica in una scheda del browser, non nell\'app installata con storage', () => {
    expect(merge(addProfile(local('base'), { menuId: 'senza-carne' }), '?lang=hi').lang).toBe('hi');
    expect(merge(local('base'), '?lang=hi', true).lang).toBeNull();
    expect(merge(local('base'), '?lang=xx').lang).toBeNull();
  });
});
