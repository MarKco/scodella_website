import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { menus } from './helpers';

// Lo script che l'Action lancia davvero (`npm run calendars`): se lo strumento che lo esegue sparisce o si rompe, lo si scopre qui e non
// a deploy fallito. Scrive in public/calendars (ignorata da git) e la ripulisce.
describe('npm run calendars', () => {
  it('genera un .ics valido per ogni menu', () => {
    const out = join(process.cwd(), 'public/calendars');
    rmSync(out, { recursive: true, force: true });
    execFileSync('npm', ['run', 'calendars', '--silent'], { cwd: process.cwd(), env: { ...process.env, SITE_URL: 'https://example.org/site/' }, stdio: 'pipe' });
    for (const m of menus) {
      const file = join(out, `${m.id}.ics`);
      expect(existsSync(file), m.id).toBe(true);
      const text = readFileSync(file, 'utf8');
      expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(text).toContain('https://example.org/site/?menu=');
    }
    rmSync(out, { recursive: true, force: true });
  }, 60_000);
});
