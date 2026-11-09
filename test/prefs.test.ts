import { describe, expect, it } from 'vitest';
import { activeMenuId, addProfile, cleanName, MAX_PROFILES, NAME_MAX, normalizeProfiles, profileLabels, removeProfile, sanitizePrefs, setActive, setProfiles, updateProfile, type Prefs } from '../src/prefs';

const empty = sanitizePrefs(null);
const prof = (...menus: string[]): Prefs => setProfiles(empty, menus.map((menuId) => ({ menuId })));

describe('profili', () => {
  it('il primo profilo è l\'attivo; lo stesso menu può comparire più volte', () => {
    const p = prof('a', 'a', 'b');
    expect(p.profiles.map((x) => x.id)).toEqual(['p1', 'p2', 'p3']);
    expect(p.profiles.map((x) => x.menuId)).toEqual(['a', 'a', 'b']);
    expect(p.activeId).toBe('p1');
    expect(activeMenuId(p)).toBe('a');
  });
  it('al massimo MAX_PROFILES profili', () => {
    const menus = Array.from({ length: MAX_PROFILES + 2 }, (_, i) => `m${i}`);
    expect(prof(...menus).profiles).toHaveLength(MAX_PROFILES);
    const full = prof(...menus.slice(0, MAX_PROFILES));
    expect(addProfile(full, { menuId: 'altro' })).toBe(full);
    expect(addProfile(prof(...menus.slice(0, MAX_PROFILES - 1)), { menuId: 'altro' }).profiles).toHaveLength(MAX_PROFILES);
  });
  it('un profilo nuovo diventa l\'attivo, con nome ripulito', () => {
    const p = addProfile(prof('a'), { menuId: 'b', name: '  Giulia   ' });
    expect(p.profiles[1]).toEqual({ id: 'p2', name: 'Giulia', menuId: 'b' });
    expect(p.activeId).toBe('p2');
  });
  it('si cambiano nome e menu di un profilo senza toccare gli altri', () => {
    const p = updateProfile(updateProfile(prof('a', 'b'), 'p2', { name: 'Marco' }), 'p2', { menuId: 'c' });
    expect(p.profiles).toEqual([{ id: 'p1', name: '', menuId: 'a' }, { id: 'p2', name: 'Marco', menuId: 'c' }]);
    expect(updateProfile(p, 'nope', { name: 'x' })).toBe(p);
  });
  it('togliendo un profilo ne resta sempre uno; se era l\'attivo passa al primo rimasto', () => {
    const p = setActive(prof('a', 'b', 'c'), 'p2');
    expect(removeProfile(p, 'p2')).toMatchObject({ activeId: 'p1', profiles: [{ id: 'p1' }, { id: 'p3' }] });
    expect(removeProfile(prof('a'), 'p1').profiles).toHaveLength(1);
    expect(setActive(p, 'zzz')).toBe(p);
  });
  it('dopo una rimozione l\'id libero si riusa', () => {
    const p = addProfile(removeProfile(prof('a', 'b'), 'p1'), { menuId: 'c' });
    expect(p.profiles.map((x) => x.id)).toEqual(['p2', 'p1']);
  });
});

describe('nomi', () => {
  it('togliono caratteri di controllo e il separatore, e si accorciano', () => {
    expect(cleanName('  Gi\u0000u|lia \n Rossi ')).toBe('Gi u lia Rossi');
    expect(cleanName('x'.repeat(100))).toHaveLength(NAME_MAX);
    expect(cleanName(42)).toBe('');
    expect(cleanName(null)).toBe('');
  });
  it('senza nome si usa quello del menu; due uguali si distinguono', () => {
    const p = setProfiles(empty, [{ menuId: 'a' }, { menuId: 'a' }, { menuId: 'a', name: 'Marco' }]);
    const labels = profileLabels(p.profiles, () => 'Menu standard');
    expect([...labels.values()]).toEqual(['Menu standard', 'Menu standard (2)', 'Marco']);
  });
});

describe('preferenze salvate', () => {
  it('migrano il formato precedente (menus + menuId) senza nomi', () => {
    const p = sanitizePrefs({ menus: ['a', 'b'], menuId: 'b', welcomed: true });
    expect(p.profiles).toEqual([{ id: 'p1', name: '', menuId: 'a' }, { id: 'p2', name: '', menuId: 'b' }]);
    expect(p.activeId).toBe('p2');
    expect(sanitizePrefs({ menuId: 'solo' })).toMatchObject({ profiles: [{ menuId: 'solo' }], activeId: 'p1' });
  });
  it('scartano profili rovinati, doppioni di id e oltre il limite', () => {
    const extra = Array.from({ length: MAX_PROFILES + 2 }, (_, i) => ({ menuId: `x${i}` }));
    const p = sanitizePrefs({ profiles: [{ id: 'p1', name: 'A', menuId: 'a' }, { id: 'p1', name: 'B', menuId: 'b' }, { id: 5, menuId: '<x>' }, null, ...extra], activeId: 'p99' });
    expect(p.profiles).toHaveLength(MAX_PROFILES);
    expect(p.profiles.slice(0, 2).map((x) => x.menuId)).toEqual(['a', 'b']);
    expect(new Set(p.profiles.map((x) => x.id)).size).toBe(MAX_PROFILES); // id sempre unici
    expect(p.activeId).toBe(p.profiles[0].id);
  });
  it('normalizeProfiles toglie i menu che non esistono più', () => {
    const p = normalizeProfiles(prof('a', 'zzz', 'b'), (id) => id !== 'zzz');
    expect(p.profiles.map((x) => x.menuId)).toEqual(['a', 'b']);
    expect(normalizeProfiles(setActive(prof('zzz', 'b'), 'p1'), (id) => id !== 'zzz').activeId).toBe(normalizeProfiles(prof('zzz', 'b'), (id) => id !== 'zzz').profiles[0].id);
  });
});
