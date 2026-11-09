import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// Il sito sta su https://markco.github.io/scodella_website/ ; con un dominio proprio: BASE_PATH=/ npm run build
const base = process.env.BASE_PATH ?? '/scodella_website/';
const version = (JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }).version;

/**
 * Content-Security-Policy come <meta> (GitHub Pages non permette header). Il sito non carica nulla da fuori: script, stili, font, immagini
 * e dati sono tutti dello stesso sito; il manifest `data:` serve all'icona Home di iPhone (vedi src/manifest.ts). Solo in produzione:
 * il server di sviluppo di Vite usa script inline. (`frame-ancestors` non si può dichiarare in un <meta>.)
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self' data:",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'scodella-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['test/**/*.test.{ts,mjs}'] },
  plugins: [
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'Scodella – Menu mense di Venezia',
        short_name: 'Scodella',
        description: 'I menu delle scuole dell’infanzia e primarie del Comune di Venezia, con le variazioni della mensa.',
        lang: 'it',
        start_url: base,
        scope: base,
        id: base,
        display: 'standalone',
        theme_color: '#B5501E',
        background_color: '#FCF7F5',
        categories: ['food', 'education', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,svg,png,woff2,webmanifest}'],
        // Il feed cambia senza deploy del sito: mai nel precache, sempre prima dalla rete.
        globIgnores: ['data/feed.json', 'badges/**', 'calendars/**'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Badge di Google Play: servono solo a chi li vede, non vanno nel precache.
            urlPattern: ({ url }: { url: URL }) => url.pathname.includes('/badges/'),
            handler: 'CacheFirst',
            options: { cacheName: 'scodella-badges', expiration: { maxEntries: 10 } },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.endsWith('/data/feed.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'scodella-feed', networkTimeoutSeconds: 4, expiration: { maxEntries: 1 } },
          },
        ],
      },
    }),
  ],
});
