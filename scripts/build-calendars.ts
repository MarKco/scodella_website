// Genera i calendari in abbonamento (.ics), uno per menu, in public/calendars/. Si lancia prima del build, dopo aver letto il feed:
//   SITE_URL=https://scodella.eu/ npx vite-node scripts/build-calendars.ts
// (vite-node serve per importare direttamente i moduli TypeScript del sito.)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildCalendar } from '../src/domain/ics';
import { Model } from '../src/domain/model';
import { assembleMenus } from '../src/domain/menus';
import { EMPTY_FEED, EMPTY_PACK, type Feed, type MenuFile, type SeasonRecipes } from '../src/domain/types';

const root = resolve(__dirname, '..');
const data = join(root, 'public/data');
const out = join(root, 'public/calendars');
const siteUrl = (process.env.SITE_URL ?? 'https://scodella.eu/').replace(/\/?$/, '/');
const uidDomain = new URL(siteUrl).hostname;

const read = <T>(f: string): T => JSON.parse(readFileSync(join(data, f), 'utf8')) as T;
const menus = assembleMenus(read<MenuFile[]>('menus.json'));
const feed: Feed = existsSync(join(data, 'feed.json')) ? { ...EMPTY_FEED, ...read<Feed>('feed.json') } : EMPTY_FEED;
const staticData = {
  menus,
  dishes: read<{ dishes: Record<string, never> }>('dishes.json').dishes,
  closures: read<{ from: string; to: string; label: string }[]>('closures.json'),
  recipes: read<Record<string, SeasonRecipes>>('recipes.json'),
};

mkdirSync(out, { recursive: true });
let total = 0;
for (const menu of menus) {
  // «Oggi» = primo giorno del menu: così il Model usa proprio questo menu e non passa a quello della stagione successiva.
  const model = new Model(staticData as never, feed, EMPTY_PACK, 'it', menu.id, menu.validFrom);
  const ics = buildCalendar({ model, baseUrl: siteUrl, uidDomain, now: Date.now() });
  writeFileSync(join(out, `${menu.id}.ics`), ics);
  total += ics.length;
  console.log(`${menu.id}.ics  ${(ics.length / 1024).toFixed(0)} KB, ${(ics.match(/BEGIN:VEVENT/g) ?? []).length} eventi`);
}
console.log(`${menus.length} calendari, ${(total / 1024).toFixed(0)} KB in tutto → ${out}`);
