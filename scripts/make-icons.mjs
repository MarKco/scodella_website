#!/usr/bin/env node
// Genera le icone della PWA da docs/icon.svg dell'app (serve `rsvg-convert`: brew install librsvg).
// I PNG risultanti sono nel repo: si rilancia solo se l'icona cambia.
//   node scripts/make-icons.mjs [percorso/icon.svg]

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(process.argv[2] ?? process.env.SCODELLA_ICON ?? join(root, '..', 'scodella', 'docs', 'icon.svg'));
const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });

const svg = readFileSync(src, 'utf8');
const bg = '<rect width="108" height="108" fill="url(#bg)"/>';
if (!svg.includes(bg) || !svg.includes('<g clip-path="url(#round)">')) throw new Error('icon.svg non ha la struttura attesa');

// 1. Quella dell'app (angoli arrotondati): per il sito e la favicon.
copyFileSync(src, join(out, 'icon.svg'));

// 2. A tutto campo, senza angoli: apple-touch-icon (iOS arrotonda da sé).
const square = svg.replace('<g clip-path="url(#round)">', '<g>');
// 3. Maskable: sfondo a tutto campo e disegno al 70% per stare nella zona sicura.
const inner = square.slice(square.indexOf(bg) + bg.length, square.lastIndexOf('</g>'));
const maskable = square.replace(inner, `<g transform="translate(54 54) scale(.7) translate(-54 -54)">${inner}</g>`);

const tmp = (name, content) => {
  const p = join(out, name);
  writeFileSync(p, content);
  return p;
};
const render = (file, size, dest) => execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), file, '-o', join(out, dest)]);

const squareFile = tmp('.square.svg', square);
const maskFile = tmp('.maskable.svg', maskable);
render(src, 192, 'icon-192.png');
render(src, 512, 'icon-512.png');
render(maskFile, 512, 'icon-maskable-512.png');
render(squareFile, 180, 'apple-touch-icon.png');
render(src, 32, 'favicon-32.png');
for (const f of ['.square.svg', '.maskable.svg']) execFileSync('rm', [join(out, f)]);
console.log('Icone generate in', out);
