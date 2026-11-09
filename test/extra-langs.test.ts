import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTRA } from '../src/i18n';

const placeholders = (s: string) => (s.match(/%\d\$s/g) ?? []).sort();
const load = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(join(process.cwd(), 'public/data/extra', `${lang}.json`), 'utf8'));

describe('testi del sito tradotti', () => {
  it('italiano e inglese hanno le stesse chiavi', () => {
    expect(Object.keys(EXTRA.it).sort()).toEqual(Object.keys(EXTRA.en).sort());
  });

  for (const lang of ['hi', 'bn', 'te', 'ta', 'mr']) {
    it(`${lang}: stesse chiavi e stessi segnaposto dell'inglese`, () => {
      const t = load(lang);
      expect(Object.keys(t).sort()).toEqual(Object.keys(EXTRA.en).sort());
      for (const [k, v] of Object.entries(t)) {
        expect(v.trim(), k).not.toBe('');
        expect(placeholders(v), k).toEqual(placeholders(EXTRA.en[k]));
      }
    });
  }
});
