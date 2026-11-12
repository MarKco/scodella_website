#!/usr/bin/env node
// Scarica il feed della mensa da Firestore (REST) in public/data/feed.json, facendo il minimo di letture.
//
//   FIRESTORE_API_KEY=... node scripts/fetch-feed.mjs [--site-url https://scodella.eu/] [--force]
//
// 1. legge `feed/meta` (1 lettura Firestore);
// 2. confronta `version` con quella del feed.json già pubblicato sul sito;
// 3. solo se è cambiata (o con --force) legge `feed/current` (1 lettura) e scrive public/data/feed.json.
//
// Se Firestore non risponde ma il sito ha già un feed, lo riscarica da lì: il deploy non perde mai le variazioni già note.
// Scrive `changed=true|false` su $GITHUB_OUTPUT (se c'è). La chiave API non viene mai stampata: va nell'header, non nell'URL.

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = process.env.FIRESTORE_PROJECT ?? 'scodella-1dff9';
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);

const siteUrl = (opt('--site-url', process.env.SITE_URL ?? 'https://scodella.eu/')).replace(/\/?$/, '/');
const key = process.env.FIRESTORE_API_KEY;
const out = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'public/data/feed.json');
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const setOutput = (name, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};
const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `ATTENZIONE: ${msg}`);

/** Valore tipizzato di Firestore REST → JSON semplice; i timestamp diventano millisecondi epoch. */
export function decode(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}
export const decodeFields = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));

async function getDoc(path) {
  const res = await fetch(`${base}/${path}`, { headers: { 'x-goog-api-key': key ?? '' } });
  if (!res.ok) throw new Error(`Firestore ${path}: HTTP ${res.status}`);
  return decodeFields((await res.json()).fields ?? {});
}

async function published() {
  try {
    const res = await fetch(`${siteUrl}data/feed.json`, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) return null;
    const text = await res.text();
    return { text, feed: JSON.parse(text) };
  } catch {
    return null;
  }
}

function write(text) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text.endsWith('\n') ? text : text + '\n');
}

async function main() {
  const online = await published();
  if (!key) {
    if (!online) {
      warn('FIRESTORE_API_KEY non impostata e nessun feed pubblicato: il sito parte senza variazioni.');
      setOutput('changed', 'false');
      return;
    }
    warn('FIRESTORE_API_KEY non impostata: riuso il feed già pubblicato.');
    write(online.text);
    setOutput('changed', 'false');
    return;
  }
  try {
    const meta = await getDoc('feed/meta');
    const version = Number(meta.version ?? 0);
    if (!flag('--force') && online && online.feed.version === version) {
      write(online.text);
      console.log(`Feed invariato (versione ${version}): 1 lettura Firestore.`);
      setOutput('changed', 'false');
      return;
    }
    const current = await getDoc('feed/current');
    const feed = {
      version: Number(current.version ?? version),
      updatedAt: Number(current.updatedAt ?? 0),
      variations: current.variations ?? [],
      moves: current.moves ?? [],
      messages: current.messages ?? [],
      config: current.config ?? {},
    };
    write(JSON.stringify(feed));
    console.log(`Feed aggiornato: versione ${feed.version}, ${feed.variations.length} variazioni, ${feed.moves.length} spostamenti, ${feed.messages.length} messaggi (2 letture Firestore).`);
    setOutput('changed', 'true');
  } catch (e) {
    warn(`Lettura da Firestore fallita (${e.message}).`);
    if (online) {
      write(online.text);
      console.log('Riuso il feed già pubblicato.');
    }
    setOutput('changed', 'false');
    process.exitCode = flag('--strict') ? 1 : 0;
  }
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
