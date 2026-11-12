# Scodella aperto ai fork: pulizia e configurazione di sito e app

## Context
Marco vuole aprire i due repo (sito `scodella_website`, già pubblico GPL-3.0; app `scodella`, oggi privato GPL-3.0) a collaboratori che facciano fork per altri comuni/province. Audit: **nessuna credenziale** nei file o nella storia di entrambi. Restano dati personali, materiale di terzi (Comune/Ames), valori legati all'infrastruttura di Marco sparsi nel codice e nessuna guida per chi fa un fork.
Decisioni: pulizia **+ pronto ai fork**; materiale Comune/Ames: **via i grezzi, restano i JSON derivati con NOTICE**; email: **fuori dai file, storia invariata** (nessun rewrite, autore dei commit invariato). Non cambio la visibilità del repo dell'app (lo fa Marco).

## Email di riferimento: `info@scodella.eu`
Unico indirizzo pubblico di contatto, nel sito e nell'app (decisione di Marco). **Non** sostituisce l'email dell'amministratore in `firestore.rules`/`AdminConfig.kt`: quella è l'account Google con cui si accede all'app admin, e cambiarla bloccherebbe le pubblicazioni; va solo spostata in configurazione (vedi App, punto 1).
- **App**: `ReportIssue.kt:20` `scodella@marcozanetti.it` → `info@scodella.eu` (default di `scodella.reportEmail`); `README.md:41`, `CLAUDE.md:100`; `play-store/privacy-policy.md` segnaposto `<email>` (7 lingue, righe 27/43/59/75/91/107/123) → `info@scodella.eu`, e nota della riga 8 aggiornata; scheda Play: indirizzo di contatto (da cambiare a mano in Play Console, lo segnalo).
- **Sito**: in `SITE.contactEmail` della config; riga «Contatti: info@scodella.eu» nella sezione Info delle Impostazioni (`src/ui/settingsView.ts`, nuova chiave `info_contact` in `EXTRA` it/en e `public/data/extra/*.json`, testo mostrato come indirizzo + link `mailto:`); README, `CONTRIBUTING.md`, `SECURITY.md` (segnalazioni di sicurezza a info@scodella.eu). «Segnala un errore» resta su GitHub Issues.

## Sito (`/Users/marco/projects/my/scodella_website`)
1. **Configurazione unica** `site.config.ts` (riusata da `vite.config.ts`, `src/links.ts`, `src/platform.ts`, `src/domain/ics.ts`, script): nome app, nome comune, `SITE_URL`, `REPO`, `PLAY_PACKAGE` (vuoto → niente badge/banner Play in `src/ui/components.ts`), PRODID/descrizione ICS, fuso orario. Gli script (`scripts/fetch-feed.mjs`, `build-calendars.ts`) leggono `SITE_URL`/`FIRESTORE_PROJECT` da env.
2. **Workflow** `.github/workflows/update-site.yml`: `scodella.eu` (righe ~60, 76) → `vars.SITE_URL`; `FIRESTORE_PROJECT` da `vars`. **Fix fork**: `fetch-feed.mjs` (righe ~22, 70-81) senza chiave non deve scaricare il feed di scodella.eu: se `SITE_URL` non è impostato o non c'è chiave → feed vuoto/statico locale.
3. Testi Venezia restano come contenuto della istanza di Marco (sono dati, non codice): li elenco nella guida (i18n.ts righe 119-160/264-305, `public/data/extra/*.json`, `index.html`, manifest) invece di parametrizzarli tutti.
4. **Licenze/file comunità**: `public/fonts/OFL.txt` (Fraunces); `NOTICE.md` (dati dei menu: fonte Comune di Venezia/Ames, URL ricette `comunedivenezia.amescloud.it`, badge Google Play marchio Google); `CONTRIBUTING.md`; `docs/ADATTARE.md` (it + breve sezione en): cosa sostituire (config, `public/data/*`, testi), schema dei file dati (`menus.json`, `dishes.json`, `closures.json`, `recipes.json`, `lang`, `extra`, feed), dipendenza da app (`sync-from-app.mjs`) e alternativa senza app (JSON a mano), Firestore proprio o feed statico, attivare i workflow pianificati nel fork, keepalive.
5. **.gitignore**: `.claude/`, `.env`, `.env.*`.
6. **Pulizie**: commento «repo privato» in `scripts/sync-from-app.mjs:2` coerente con lo stato; README: link a `test/theme.test.ts` inesistente (riga ~114), sezione «Fork per un'altra città» → `docs/ADATTARE.md`.
7. **Ref locali** con la storia vecchia: `backup-prima-squash` e `refs/original/...` restano locali; nessun push `--all`/`--mirror` (lo dico, non li cancello).

## App (`/Users/marco/projects/my/scodella`)
1. **Email e progetto in configurazione**:
   - `admin/.../core/AdminConfig.kt:5,11` → `BuildConfig` da `local.properties`/`gradle.properties` (`scodella.adminEmail`, `scodella.firebaseProject`), con default vuoti e messaggio chiaro.
   - `firestore.rules:12` → `firestore.rules.example` con segnaposto; `firestore.rules` reale ignorato da git (deploy da file locale) — documentato in `docs/admin.md`.
   - `tools/publish_canteen.py:56`, `tools/emulator/check_rules.py:7,29,31` → variabili d'ambiente.
   - `ReportIssue.kt:20` → valore da `gradle.properties` (`scodella.reportEmail`, default `info@scodella.eu`), vuoto = pulsante nascosto.
   - Docs (`docs/admin.md`, `docs/firebase.md`, skill `.claude/skills/pubblica-variazione`, `tools/emulator/check_rules.py`): email dell'admin → segnaposto/variabile d'ambiente.
2. **Dati personali**: `play-store/source/capture_tablet.sh:9` percorso `/Users/marco` → relativo; `tools/recipes_links/autunnale-2026.json:2` «confermati da Marco» → neutro. `play-store/privacy-policy*.md` (titolare del trattamento) e `docs/crashlytics-plan.md`: restano (sono la tua istanza), segnalati nella guida come da sostituire.
3. **Materiale Comune/Ames**: `git rm --cached` + `.gitignore` per `asset/2026-autunno/*.pdf`, i JSON estratti (`asset/2026-autunno/*.json`, `ingredienti_dettaglio_completo.json`) e `docs/menu-grammature/*.md|.docx` derivati; i file restano su disco. Restano tracciati `app/src/main/assets/**` (menu, piatti, chiusure, ricette) e gli script `tools/`/`asset/script/` come esempio. `NOTICE.md` sulla provenienza.
   ⚠️ Restano nella **storia**: se un giorno rendi pubblica l'app con la storia attuale, PDF ed email si vedono. Prima di pubblicarla conviene uno squash (come per il sito) — non lo faccio ora.
4. **.gitignore**: `.DS_Store`, `.env`; `CLAUDE.md` e `.claude/` restano tracciati (utili ai collaboratori, senza segreti dopo il punto 1).
5. **Licenze/comunità**: `OFL.txt` accanto a `app/src/main/res/font/fraunces.ttf` (o NOTICE); `CONTRIBUTING.md`; `docs/ADATTARE.md`: package id da cambiare (`com.ilsecondodasinistra.scodella`), `google-services.json` proprio (opzionale: senza, l'app funziona senza aggiornamenti remoti), keystore di upload proprio, sostituire `app/src/main/assets/*`, import menu (`tools/menu_import.py` è specifico del PDF di Venezia), scraper Ames (`asset/script/scraper_ames_*.py`, id menu 72/76/78), `LEGACY_MENU_ID` (`UserDb.kt:70`), livelli scolastici (`Recipes.kt:110`), testi `info_about_text`, materiale Play e social.
6. **README**: togliere Syncthing/`docs/sync.md`, «Modulo unico» → moduli `app`, `domain`, `admin`, `baselineprofile`; sezione fork → `docs/ADATTARE.md`.

## Commit
Un commit per repo (messaggi in italiano, **senza** riga Co-Authored-By). Push del sito su richiesta; app: push sul suo remote privato su richiesta. Nessun cambio di visibilità.

## Verifica
- Sito: `npx vitest run`, `npx tsc --noEmit`, `npm run build`; `npm run dev` e controllo che sito, calendario ICS (`scripts/build-calendars.ts`) e badge Play funzionino con la config attuale; `node scripts/fetch-feed.mjs` senza chiave e senza `SITE_URL` → nessuna richiesta a scodella.eu.
- App: `./gradlew :domain:test :app:assembleDebug :admin:assembleDebug` con i valori in `local.properties`, e senza (build ok, admin mostra errore di config, pulsante segnalazione nascosto). `tools/emulator/check_rules.py` con env.
- Entrambi: `git grep -n -e ilsecondodasinistra@ -e marcozanetti.it -e /Users/marco -e scodella-1dff9` → solo docs/config di esempio o nessun risultato; `git status` mostra PDF/JSON grezzi come ignorati, ancora presenti su disco.
