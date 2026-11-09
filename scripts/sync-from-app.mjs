#!/usr/bin/env node
// Copia e riduce i dati statici dell'app Android (repo privato MarKco/scodella) in public/data/.
// Da lanciare a mano quando esce un nuovo menu stagionale (o cambiano piatti/traduzioni), poi commit.
//
//   node scripts/sync-from-app.mjs [percorso/del/repo/scodella]
//   SCODELLA_APP=/percorso npm run sync
//
// Output (tutto in public/data/):
//   menus.json            file dei menu (base + diete) come negli asset, in un unico array
//   dishes.json           catalogo piatti (senza costIndex)
//   closures.json         calendario chiusure fisso
//   recipes.json          { <stagione>: { links, recipes, ingredients } } ridotto: SOLO ingredienti, allergeni, tracce
//                         (niente grammature, valori nutrizionali, foto, documenti, schede di conservazione)
//   lang/<lingua>.json    { ui, dishes, menus, closures, notes, ingredients, terms } per ogni lingua
//
// Non tocca feed.json: quello viene dall'Action (scripts/fetch-feed.mjs).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const appRoot = resolve(process.argv[2] ?? process.env.SCODELLA_APP ?? join(root, '..', 'scodella'));
const assets = join(appRoot, 'app/src/main/assets');
const res = join(appRoot, 'app/src/main/res');
const out = join(root, 'public/data');

if (!existsSync(assets)) {
  console.error(`Non trovo gli asset dell'app in ${assets}.\nPassa il percorso del repo scodella come argomento o in SCODELLA_APP.`);
  process.exit(1);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v) + '\n');
};

// --- menu -------------------------------------------------------------------------------------------------------
const menuDir = join(assets, 'menus');
const menus = readdirSync(menuDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => readJson(join(menuDir, f)));
writeJson(join(out, 'menus.json'), menus);

// --- piatti, chiusure --------------------------------------------------------------------------------------------
const dishes = readJson(join(assets, 'dishes.json')).dishes;
for (const d of Object.values(dishes)) delete d.costIndex;
writeJson(join(out, 'dishes.json'), { dishes });
writeJson(join(out, 'closures.json'), readJson(join(assets, 'closures.json')));

// --- ricette (ridotte) -------------------------------------------------------------------------------------------
const recipes = {};
const recipeDir = join(assets, 'recipes');
for (const f of readdirSync(recipeDir).filter((n) => n.endsWith('.json'))) {
  const r = readJson(join(recipeDir, f));
  recipes[r.season] = {
    links: r.links ?? {},
    recipes: Object.fromEntries(
      Object.entries(r.recipes).map(([id, x]) => [
        id,
        {
          name: x.name,
          ingredients: x.ingredients,
          allergens: x.allergens ?? [],
          traces: x.traces ?? [],
          flags: x.flags ?? [],
          tags: x.tags ?? [],
          url: x.url ?? null,
        },
      ]),
    ),
    ingredients: Object.fromEntries(
      Object.entries(r.ingredients).map(([id, x]) => [
        id,
        {
          name: x.name,
          ...(x.composition ? { composition: x.composition } : {}),
          ...(x.organic ? { organic: true } : {}),
          ...(x.frozen ? { frozen: true } : {}),
        },
      ]),
    ),
  };
}
writeJson(join(out, 'recipes.json'), recipes);

// --- stringhe dell'interfaccia (strings.xml) ---------------------------------------------------------------------
// Solo le chiavi che il sito usa (prefissi o nomi esatti). Il resto dell'interfaccia web sta in src/i18n/extra.ts.
const UI_KEYS = [
  /^category_/, /^kind_/, /^allergen_/, /^flag_/, /^level_/, /^season_/, /^nutr_/,
  /^week_label$/, /^today$/, /^go_to_today$/, /^pick_date$/, /^pick_date_confirm$/, /^cancel$/, /^settings$/, /^back$/,
  /^menu_unavailable_/, /^menu_none$/, /^change_menu$/, /^dish_replaced_original$/, /^dish_deleted$/,
  /^egg_/, /^meat_/, /^fish_/, /^streak_/,
  /^dish_info_(ingredients|unavailable|organic|frozen)$/, /^info_(allergens|traces|none|source|seasonality|about_text)$/,
  /^settings_(menu_|look_|language|show_|info_section)/, /^canteen_(badge|moved_banner)$/, /^closure_(title|reason_default|range)$/,
  /^welcome_/, /^range_from_to$/, /^app_name$/,
  /^stats_(title|period_|empty|summary|days_with_changes|dish_pairs|most_|by_|replaced$|more$)/, /^kind_other$/,
];
const wanted = (name) => UI_KEYS.some((re) => re.test(name));

const unescapeXml = (s) =>
  s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\@/g, '@')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/%(\d)\$d/g, '%$1$s')
    .replace(/%d/g, '%1$s');

function parseStrings(dir) {
  const file = join(res, dir, 'strings.xml');
  if (!existsSync(file)) return {};
  const xml = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const result = {};
  for (const m of xml.matchAll(/<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)) {
    if (wanted(m[1])) result[m[1]] = unescapeXml(m[2].trim());
  }
  for (const m of xml.matchAll(/<plurals\s+name="([^"]+)">([\s\S]*?)<\/plurals>/g)) {
    if (!wanted(m[1])) continue;
    const forms = {};
    for (const i of m[2].matchAll(/<item\s+quantity="([^"]+)">([\s\S]*?)<\/item>/g)) forms[i[1]] = unescapeXml(i[2].trim());
    result[m[1]] = forms;
  }
  return result;
}

const langs = { it: 'values-it', en: 'values', hi: 'values-hi', bn: 'values-bn', te: 'values-te', ta: 'values-ta', mr: 'values-mr' };
for (const [lang, dir] of Object.entries(langs)) {
  const ui = parseStrings(dir);
  let content = { dishes: {}, menus: {}, closures: {}, notes: {}, ingredients: {}, terms: {} };
  const file = join(assets, 'i18n', `${lang}.json`);
  if (existsSync(file)) {
    const t = readJson(file);
    // Solo nome e composizione degli ingredienti: gli altri campi non servono al sito.
    const ingredients = {};
    for (const [key, fields] of Object.entries(t.ingredients ?? {})) {
      const id = key.split('/').pop();
      const season = key.split('/')[0];
      const slim = {};
      if (fields.name) slim.name = fields.name;
      if (fields.composition) slim.composition = fields.composition;
      if (Object.keys(slim).length) ingredients[`${season}/${id}`] = slim;
    }
    content = {
      dishes: t.dishes ?? {},
      menus: t.menus ?? {},
      closures: t.closures ?? {},
      notes: t.notes ?? {},
      ingredients,
      terms: t.terms ?? {},
    };
  }
  writeJson(join(out, 'lang', `${lang}.json`), { ui, ...content });
}

console.log(`Sincronizzato da ${appRoot} in ${out}:`);
console.log(`  ${menus.length} file di menu, ${Object.keys(dishes).length} piatti, ${Object.keys(recipes).length} stagioni di ricette, ${Object.keys(langs).length} lingue`);
