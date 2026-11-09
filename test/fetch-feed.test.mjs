import { describe, expect, it } from 'vitest';
import { decode, decodeFields } from '../scripts/fetch-feed.mjs';

describe('decoder dei valori Firestore REST', () => {
  it('converte i tipi base e i timestamp in millisecondi', () => {
    expect(decode({ stringValue: 'ciao' })).toBe('ciao');
    expect(decode({ integerValue: '1762680000000' })).toBe(1762680000000);
    expect(decode({ doubleValue: 1.5 })).toBe(1.5);
    expect(decode({ booleanValue: false })).toBe(false);
    expect(decode({ nullValue: null })).toBeNull();
    expect(decode({ timestampValue: '2026-11-09T10:00:00Z' })).toBe(Date.parse('2026-11-09T10:00:00Z'));
  });

  it('converte mappe e array annidati, anche vuoti', () => {
    expect(decode({ arrayValue: {} })).toEqual([]);
    expect(decode({ mapValue: {} })).toEqual({});
    const doc = decodeFields({
      version: { integerValue: '7' },
      variations: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: 'a' }, active: { booleanValue: true }, names: { mapValue: { fields: { it: { stringValue: 'Pizza' } } } } } } }] } },
      config: { mapValue: { fields: { closures: { arrayValue: {} } } } },
    });
    expect(doc).toEqual({ version: 7, variations: [{ id: 'a', active: true, names: { it: 'Pizza' } }], config: { closures: [] } });
  });
});
