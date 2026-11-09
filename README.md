# Scodella – sito web

Sito statico e PWA con i menu delle scuole dell'infanzia e primarie del Comune di Venezia: la versione web dell'app Android
[Scodella](https://github.com/MarKco/scodella). Gira su GitHub Pages: **https://markco.github.io/scodella_website/**

Non è un sito ufficiale del Comune di Venezia.

## Cosa fa

- Menu del giorno (swipe o frecce, striscia lun–ven, settimana A–E, link diretto `#/2026-11-12`), calendario del mese e
  variazioni del periodo.
- Variazioni di piatto, spostamenti di giorno, chiusure e messaggi pubblicati dalla mensa.
- Piatti con ingredienti e allergeni (senza grammature). Menu standard e diete speciali.
- **Layout responsive**: telefono (colonna con barra in basso), tablet (colonna larga) e desktop da 1024 px (barra laterale,
  giorno + mini calendario, intera settimana sotto, calendario con i piatti nelle celle, foglio del piatto come pannello laterale).
- **Badge dell'app Android** (Google Play) in un avviso chiudibile e nelle Impostazioni; non compare su iPhone/iPad.
- **Calendario in abbonamento** (`.ics`, link `webcal://`): ogni giorno di mensa diventa un evento nel calendario del telefono; i giorni
  variati sono segnati «⚠️ VARIATO» e hanno un avviso alle 7:00. Pensato soprattutto per chi usa iPhone.
- **Tutti i menu della famiglia**: con 2 o più bambini, il chip «Tutti» affianca i loro menu del giorno in una tabella (una riga per portata,
  una colonna per bambino), con le portate diverse evidenziate e l'interruttore «Solo le differenze».
- **Fino a 5 profili** (un bambino e il suo menu, anche lo stesso menu per due figli, con un nome facoltativo) e **scelta nell'indirizzo**
  (`?menu=…&saved=…&p=…&lang=…`): l'icona sulla schermata Home di iPhone si apre già sul menu giusto.
- 7 lingue (it, en, hi, bn, te, ta, mr), tema chiaro/scuro, installabile come app e utilizzabile offline.

## Come arrivano i dati (senza redeploy a mano)

```
 skill / app admin ──scrive──▶ Firestore (feed/meta, feed/current)
                                    │  1 lettura ogni ora (2 solo se è cambiato qualcosa)
                                    ▼
        GitHub Action "Aggiorna sito" ──build + deploy──▶ GitHub Pages (data/feed.json statico)
                                                               ▲
                                              i visitatori leggono solo file statici
```

- **Le variazioni** vivono in `data/feed.json`, generato dall'Action da Firestore. I visitatori **non toccano mai Firestore**:
  le letture non dipendono dal traffico del sito (circa 24 al giorno in tutto).
- **L'Action** (`.github/workflows/update-site.yml`) gira una volta all'ora: legge `feed/meta` (1 lettura), confronta la
  versione con quella già online e, **solo se è cambiata**, scarica `feed/current`, rifà il build e pubblica. Altrimenti esce
  in pochi secondi. Non fa commit: la cronologia git resta pulita. Per l'ora esatta GitHub può ritardare il cron di qualche minuto.
- **Subito dopo una pubblicazione** si può forzare l'aggiornamento con `gh workflow run update-site.yml -R MarKco/scodella_website`
  (vedi «Aggiornamento immediato» sotto).
- **I menu, le diete, i piatti, gli ingredienti e le traduzioni** non sono su Firestore: stanno negli asset dell'app e si copiano
  qui con `npm run sync` quando esce un menu nuovo (vedi sotto). Il sito si rideploya da solo al push.
- Il browser ricontrolla il feed quando si riapre la pagina e ogni 10 minuti; offline mostra l'ultimo letto.

## Calendario in abbonamento

L'Action genera ogni volta, prima del build, un file per ognuno dei 12 menu (`https://markco.github.io/scodella_website/calendars/<menu>.ics`)
con `npm run calendars` (script `scripts/build-calendars.ts`, che usa gli stessi moduli del sito: nessuna regola duplicata). Il file ha un
evento «tutto il giorno» per ogni giorno di mensa, con i piatti, le variazioni («al posto di…»), gli spostamenti e le chiusure.

- `UID` stabile e `SEQUENCE` che sale a ogni variazione o ritiro che riguarda il giorno: i client rileggono l'evento.
- Nei giorni variati c'è un avviso alle 7:00 (`VALARM`). Per riceverlo su iPhone, nelle impostazioni del calendario sottoscritto si disattiva
  «Rimuovi avvisi». Google Calendar non mostra gli avvisi dei calendari sottoscritti e li aggiorna con calma (anche dopo 24 ore).
- Provare in locale: `npm run calendars` scrive in `public/calendars/` (ignorata da git) e il file si legge con qualunque libreria iCalendar.

## Profili, indirizzo e icona Home (iPhone)

- Un **profilo** è un bambino con il suo menu (nome facoltativo); se ne seguono fino a 5 e lo stesso menu può comparire più volte. Si
  scelgono nella schermata iniziale (una scheda per bambino) e si gestiscono in Impostazioni › «I miei menu». In cima a ogni vista c'è la
  riga dei profili con «＋ Aggiungi» (nascondibile con la X), che apre le Impostazioni sul pannello per aggiungere (`#/settings/add-menu`).
- **I nomi dei bambini restano sul dispositivo** (`localStorage`): non entrano mai nell'indirizzo visibile né in «Copia il link con la mia
  scelta». Fa eccezione lo `start_url` dell'icona Home di iPhone, che resta sul telefono e porta anche `names=…`, perché l'app installata non
  vede lo storage di Safari: all'apertura i nomi si leggono e si tolgono subito dall'indirizzo (`src/startup.ts`, `src/urlstate.ts`).
- La scelta (profili, profilo attivo, lingua) sta in `localStorage` **e nell'indirizzo**. L'icona Home riapre con lo `start_url` di quando è
  stata aggiunta; **nell'app installata, con profili già salvati, comanda lo storage** (altrimenti rimetterebbe attivo a ogni avvio il
  profilo di allora). **Prima di «Aggiungi alla schermata Home» scegli i profili.**
- Un link con `?menu=…` in una scheda del browser si unisce ai profili già salvati e fa saltare il benvenuto.
- `?oggi=AAAA-MM-GG` simula la data (banner giallo): utile per provare giorni di chiusura, fine settimana e cambi di stagione.

## Setup una tantum

### 1. Chiave API di sola lettura (`FIRESTORE_API_KEY`)

Serve solo all'Action per leggere `feed/*`, che le regole di Firestore rendono già leggibili da tutti. **La chiave non finisce
mai nel sito**: sta in un *secret* di GitHub e il browser dei visitatori non la vede.

1. [Google Cloud Console](https://console.cloud.google.com/) → progetto `scodella-1dff9` → *API e servizi* → *Credenziali* →
   *Crea credenziali* → *Chiave API*.
2. Rinominala, ad esempio `scodella-website-feed`.
3. In *Restrizioni API* scegli *Limita chiave* e seleziona **solo «Cloud Firestore API»**. Lascia *Restrizioni delle
   applicazioni* su «Nessuna»: gli indirizzi IP dei runner di GitHub cambiano, non si possono vincolare.
4. Copia la chiave e provala (deve rispondere con `version` e `updatedAt`):
   ```sh
   curl -H "x-goog-api-key: LA_TUA_CHIAVE" \
     "https://firestore.googleapis.com/v1/projects/scodella-1dff9/databases/(default)/documents/feed/meta"
   ```
5. Salvala come secret del repo:
   ```sh
   gh secret set FIRESTORE_API_KEY -R MarKco/scodella_website
   ```
   (oppure sul sito: *Settings → Secrets and variables → Actions → New repository secret*).
6. **Costi.** In Firebase Console › *Utilizzo e fatturazione* controlla il piano. Su **Spark** la quota è un limite rigido
   (finite le 50.000 letture al giorno Firestore risponde con errori, senza addebiti). Su **Blaze** imposta in Cloud Billing un
   *budget con avvisi* (50 %, 90 %, 100 %): gli avvisi non bloccano la spesa. Se la chiave trapela, eliminala e creane
   un'altra (il sito non cambia).

Senza la chiave il sito funziona lo stesso: mostra i menu base senza variazioni (o riusa l'ultimo feed già pubblicato).

### 2. GitHub Pages

*Settings → Pages → Build and deployment → Source: **GitHub Actions***. Il repo deve essere pubblico (Pages sul piano gratuito
non funziona con i repo privati). Poi lancia una volta a mano *Actions → Aggiorna sito → Run workflow*.

### 3. Dominio proprio (facoltativo)

Con un dominio proprio costruisci con `BASE_PATH=/` (variabile d'ambiente del passo *Build*) e aggiorna `start_url`/`scope`
in `vite.config.ts` se serve.

## Accessibilità e sicurezza

- **Test**: `npm test` esegue anche `test/a11y.test.ts` (axe-core su jsdom, sulle viste vere: ruoli, nomi e attributi ARIA). jsdom non
  misura il contrasto: quello è coperto da `test/theme.test.ts` (il testo colorato con l'accento ha sempre ≥ 4,5:1, per ogni accento).
- **Focus e scroll**: il sito ridisegna la pagina a ogni cambio di stato; i controlli che devono tenere il focus hanno `data-fk="…"` e
  `src/focus.ts` lo ripristina. Un controllo nuovo che cambia lo stato deve avere la sua chiave.
- **CSP**: la build mette una Content-Security-Policy in un `<meta>` (`vite.config.ts`). Il sito non carica nulla da fuori: niente script,
  stili o immagini inline e nessun servizio di terzi. Se serve una risorsa esterna va aggiunta lì, non con `unsafe-inline`.
- **Dati non fidati**: testi e messaggi del feed si inseriscono sempre come testo (mai `innerHTML`); gli indirizzi presi dai dati passano da
  `safeHttpUrl`; le preferenze salvate da `sanitizePrefs`.

## Sviluppo

```sh
npm install
npm run dev        # http://localhost:5173/scodella_website/
npm test           # logica di dominio (rotazione A–E, variazioni, spostamenti, chiusure…) + decoder Firestore
npm run build && npm run preview
```

Per provare variazioni, chiusure e messaggi in locale crea `public/data/feed.json` (è ignorato da git) con la forma di
`feed/current` di Firestore: `{ version, updatedAt, variations: [], moves: [], messages: [], config: {} }`, con date `AAAA-MM-GG`
e orari in millisecondi.

Con la chiave: `FIRESTORE_API_KEY=… npm run feed` scarica il feed vero (non farlo girare in modo ripetuto: ogni esecuzione legge).

### Sincronizzare i menu dall'app

Quando esce un menu stagionale (o cambiano piatti, ingredienti o traduzioni):

```sh
npm run sync -- ../scodella      # o SCODELLA_APP=/percorso/del/repo/scodella npm run sync
npm test                         # controlla che i menu si assemblino e la rotazione sia coerente
git add public/data && git commit -m "Sincronizza i dati dall'app" && git push
```

Copia in `public/data/`: `menus.json`, `dishes.json`, `closures.json`, `recipes.json` (ridotto a ingredienti e allergeni) e
`lang/*.json` (traduzioni e stringhe dell'interfaccia prese da `strings.xml`). Se l'icona dell'app cambia: `npm run icons`
(serve `rsvg-convert`).

### Aggiornamento immediato dopo una pubblicazione

Lo script dell'app (`tools/publish_canteen.py`) può avviare l'Action subito dopo aver rigenerato il feed. Nel repo dell'app,
dopo l'ultima scrittura:

```python
import os, shutil, subprocess

def trigger_site_update():
    """Best effort: avvia il deploy del sito (usa l'autenticazione `gh` del tuo Mac, nessun token nel repo)."""
    if os.environ.get("SCODELLA_SITE_NO_TRIGGER") or os.environ.get("FIRESTORE_EMULATOR_HOST") or not shutil.which("gh"):
        return
    subprocess.run(["gh", "workflow", "run", "update-site.yml", "-R", "MarKco/scodella_website"], check=False, timeout=30)
```

L'app admin non può farlo senza tenere un token dentro l'app: per quella vale il controllo orario.

## Note
- **Badge Google Play.** I PNG in `public/badges/` sono i badge ufficiali di Google, non modificati (linee guida:
  niente ritagli, rotazioni o animazioni, spazio libero attorno). Si possono riscaricare da
  `https://play.google.com/intl/en_us/badges/static/images/badges/<lingua>_badge_web_generic.png`. Il rilevamento di iOS è in
  `src/platform.ts`; l'avviso chiuso si ricorda nel `localStorage` (`playBannerDismissed`).

- **Cron e inattività.** GitHub disattiva i workflow schedulati dopo 60 giorni senza attività nel repo. L'Action fa da sé un commit
  vuoto sul ramo `keepalive` ogni ~3 settimane per evitarlo. Se un giorno gli aggiornamenti si fermano, controlla *Actions* e
  riattiva il workflow.
- **Privacy.** Niente cookie né analytics. Menu e lingua scelti stanno nel `localStorage` del browser.
- **Installazione.** Android/Chrome: *Impostazioni → Installa*. iPhone/iPad: Safari → Condividi → «Aggiungi alla schermata Home».
- **Aggiornamenti del sito.** Il service worker scarica la nuova versione in background: si vede alla riapertura successiva.
- **Dati.** I menu derivano dai PDF pubblici della Ristorazione scolastica del Comune di Venezia. Le variazioni le pubblica l'autore.
- Le stringhe proprie del sito (navigazione, impostazioni, installazione) sono tradotte solo in italiano e inglese: nelle altre
  lingue ripiegano sull'inglese (`src/i18n.ts`). Quelle dell'app (piatti, categorie, allergeni…) sono in tutte e 7.

## Licenza

GPL-3.0, vedi [LICENSE](LICENSE).
