# Changelog

## 0.4.0
- **Tutti i menu della famiglia.** Con 2 o più bambini, nella riga in cima compare il chip **«Tutti»**: apre la pagina del giorno con una tabella,
  una riga per portata e una colonna per bambino (con 4–5 bambini su telefono le colonne scorrono di lato; la colonna delle portate resta ferma).
  Le portate in cui i bambini hanno piatti diversi hanno un puntino e uno sfondo (e «diverso» a parole per chi non vede i colori); l'interruttore
  «Solo le differenze» nasconde le altre, e c'è un riepilogo («1 portata su 5 è diversa»). Le celle mostrano variazioni e «Non previsto» e, toccate,
  aprono il foglio con ingredienti e allergeni di quel menu. Stessi giorni, frecce, swipe e data della pagina del giorno.
- Il sito si **riapre sull'ultima vista** del giorno (anche «Tutti»); toccando un bambino dalla vista «Tutti» si torna alla sua pagina.

## 0.3.2
- Il limite dei profili passa da 3 a **5**. I testi dell'interfaccia leggono il valore da `MAX_PROFILES` (`src/prefs.ts`): cambiarlo ancora
  è una riga sola.
- **Schermata iniziale**: l'elenco dei menu è aperto sul bambino su cui si lavora; scelto il menu si chiude, per lasciare spazio agli altri
  bambini; aggiungendone uno si apre il suo elenco e si chiudono gli altri.
- Le righe evidenziate (al passaggio del puntatore) nelle schede dei bambini e nel campo «Menu» ora coprono tutta la larghezza.

## 0.3.1
- **Correzione**: il pannello per aggiungere un menu offriva solo il «Menu standard»; ora mostra standard e tutte le diete.
- **Impostazioni › I miei menu riprogettate**: una scheda per bambino con tutto dentro (nome, menu con «Cambia», «Usa questo»,
  «Rimuovi»), gerarchia tipografica chiara, e un pannello «Nuovo menu» con «Aggiungi» esplicito (scegliere un menu non aggiunge più nulla da solo).
  Conferme a schermo quando si aggiunge o si rimuove.
- **Ripeti la configurazione iniziale** (Impostazioni › I miei menu): riapre la schermata iniziale, precompilata con i bambini attuali e con
  «Annulla»: nulla cambia finché non si conferma.

## 0.3.0
- **Più bambini, più menu.** Si possono seguire fino a 3 profili (un bambino e il suo menu), anche con lo **stesso menu** per due figli, ciascuno
  con un **nome facoltativo**. La schermata iniziale è a schede (un bambino per scheda); in cima a ogni vista c'è la riga dei profili con
  «＋ Aggiungi» (nascondibile con la X), che porta alle Impostazioni già sul pannello per aggiungere. Le preferenze già salvate si migrano da sole.
- **Privacy dei nomi.** I nomi dei bambini restano solo sul dispositivo: mai in un indirizzo né in un link condiviso. Unica eccezione lo
  `start_url` dell'icona Home di iPhone (che resta sul telefono): all'apertura i nomi vengono letti e subito tolti dall'indirizzo visibile.
- **App installata.** Con profili già salvati comanda lo storage del dispositivo: lo `start_url` non rimette più attivo, a ogni avvio, il
  profilo di quando si è aggiunta l'icona.

## 0.2.1
Correzioni da una review di accessibilità e sicurezza.
- **Accessibilità**: gli attributi ARIA a due stati (`aria-pressed`, `aria-checked`) ora esistono sempre con `"true"`/`"false"`; dopo un clic il
  focus e lo scroll restano dove sono (prima si tornava in cima con il focus perso); il focus resta sul pulsante «giorno successivo»;
  i piatti dicono a voce cosa è variato; il calendario è una tabella vera; i controlli a scelta sono pulsanti `aria-pressed`;
  contrasto del testo colorato calcolato per ogni accento (≥ 4,5:1); l'orientamento non è più bloccato; lo swipe tra giorni non scatta
  sulla riga dei menu; l'anello di focus non è più tagliato; i fogli hanno `aria-labelledby`.
- **Sicurezza**: Content-Security-Policy (senza `unsafe-inline`) nella build; preferenze salvate validate (prima una voce rovinata
  bloccava il sito); indirizzi dai dati accettati solo se http(s); testi del calendario ripuliti dai caratteri di controllo.
- Primo disegno già scuro per chi usa il tema scuro (niente lampo bianco).
- Test automatici di accessibilità (axe-core + jsdom) sulle viste e nuovi test per ogni correzione.

## 0.2.0
- **Calendario in abbonamento**: un file `.ics` per ogni menu (base e diete), con link `webcal://`. Ogni giorno di mensa è un evento con i
  piatti; i giorni variati sono segnati «⚠️ VARIATO» e hanno un avviso alle 7:00. Lo rigenera l'Action ogni volta che cambia il feed.
- **Fino a 3 menu salvati** (per esempio le diete di due figli), con chip per passare dall'uno all'altro.
- **Scelta nell'indirizzo** (`?menu=…&saved=…&lang=…`) e `start_url` del manifest aggiornato: l'icona sulla schermata Home di iPhone
  si apre già sul menu giusto. Pulsante «Copia il link con la mia scelta».
- **Giorni senza mensa spiegati** («Oggi, sabato: niente mensa. Ecco lunedì») ed etichetta «variato» sui piatti, con giorni variati
  evidenziati nella striscia e nella settimana.
- `?oggi=AAAA-MM-GG` simula la data; «Segnala un errore» con issue precompilata; link «Vai al contenuto»; titolo di pagina per vista.

## 0.1.0
- Prima versione: menu del giorno, calendario, variazioni, ingredienti e allergeni, 7 lingue, tema chiaro/scuro, PWA offline,
  layout responsive con barra laterale su desktop e badge dell'app Android.
