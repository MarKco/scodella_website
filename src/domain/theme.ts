// Port di accentScheme() (ui/Theme.kt): tutti i colori derivano dall'accento del menu per interpolazione.
export type RGB = [number, number, number];

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
export const DEFAULT_ACCENT = '#B5501E';

export function parseHex(hex: string | null | undefined): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  const h = m ? m[1] : DEFAULT_ACCENT.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function lerp(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
}

export const css = (c: RGB) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

/** Luminanza relativa (WCAG 2.x). */
export function luminance(c: RGB): number {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapporto di contrasto tra due colori (1–21). */
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Il colore di testo più vicino a `base` che ha almeno `min` di contrasto con tutti gli `backgrounds`: lo sposta verso `toward`
 * (nero sul chiaro, bianco sullo scuro) il minimo necessario, così l'aspetto resta quello dell'accento.
 */
export function readable(base: RGB, backgrounds: RGB[], toward: RGB, min = 4.5): RGB {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = lerp(base, toward, Math.min(t, 1));
    if (backgrounds.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return toward;
}

export function accentScheme(hex: string | null | undefined, dark: boolean): Record<string, string> {
  const a = parseHex(hex);
  // Scuro ad alto contrasto: fondo quasi nero, testo quasi bianco, superfici ben staccate tra loro e bordi netti.
  const night = lerp([0x14, 0x10, 0x0f], a, 0.03);
  const grey: RGB = [0x8a, 0x80, 0x78];
  const s = dark
    ? {
        primary: lerp(a, WHITE, 0.5),
        'on-primary': lerp(a, BLACK, 0.85),
        'primary-container': lerp(a, BLACK, 0.4),
        'on-primary-container': lerp(a, WHITE, 0.92),
        secondary: lerp(a, WHITE, 0.72),
        'secondary-container': lerp(a, BLACK, 0.55),
        'on-secondary-container': lerp(a, WHITE, 0.92),
        tertiary: [0xb9, 0xe6, 0xa0] as RGB,
        'tertiary-container': [0x2f, 0x53, 0x20] as RGB,
        'on-tertiary-container': [0xe6, 0xf5, 0xd9] as RGB,
        background: night,
        'on-background': lerp(a, WHITE, 0.96),
        surface: night,
        'on-surface': lerp(a, WHITE, 0.96),
        'surface-variant': lerp(night, WHITE, 0.14),
        'on-surface-variant': lerp(a, WHITE, 0.85),
        'surface-low': lerp(night, WHITE, 0.07),
        'surface-container': lerp(night, WHITE, 0.1),
        'surface-high': lerp(night, WHITE, 0.13),
        outline: lerp(a, WHITE, 0.68),
        'outline-variant': lerp(night, WHITE, 0.28),
        'primary-text': readable(lerp(a, WHITE, 0.5), [night, lerp(night, WHITE, 0.07), lerp(night, WHITE, 0.1), lerp(night, WHITE, 0.13), lerp(night, WHITE, 0.14), lerp(a, BLACK, 0.4)], WHITE),
      }
    : {
        primary: a,
        'on-primary': WHITE,
        'primary-container': lerp(a, WHITE, 0.82),
        'on-primary-container': lerp(a, BLACK, 0.62),
        secondary: lerp(a, [0x6d, 0x5e, 0x52], 0.55),
        'secondary-container': lerp(a, WHITE, 0.88),
        'on-secondary-container': lerp(a, BLACK, 0.6),
        tertiary: [0x4e, 0x7a, 0x3c] as RGB,
        'tertiary-container': [0xd7, 0xeb, 0xc8] as RGB,
        'on-tertiary-container': [0x1c, 0x3a, 0x10] as RGB,
        background: lerp(a, WHITE, 0.955),
        'on-background': lerp(a, BLACK, 0.85),
        surface: lerp(a, WHITE, 0.955),
        'on-surface': lerp(a, BLACK, 0.85),
        'surface-variant': lerp(a, WHITE, 0.9),
        'on-surface-variant': lerp(a, BLACK, 0.5),
        'surface-low': lerp(a, WHITE, 0.88),
        'surface-container': lerp(a, WHITE, 0.85),
        'surface-high': lerp(a, WHITE, 0.82),
        outline: lerp(a, grey, 0.6),
        'outline-variant': lerp(a, WHITE, 0.7),
        // Testo colorato con l'accento (piatto variato, pulsanti «testo»): ≥ 4,5:1 su tutti gli sfondi in cui compare.
        'primary-text': readable(a, [lerp(a, WHITE, 0.955), lerp(a, WHITE, 0.9), lerp(a, WHITE, 0.88), lerp(a, WHITE, 0.85), lerp(a, WHITE, 0.82)], BLACK),
      };
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [`--${k}`, css(v as RGB)]));
}
