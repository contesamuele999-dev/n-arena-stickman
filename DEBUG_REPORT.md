# Audit di N+ Arena

Data: 28 agosto 2026.

## Esito

Eseguita un'analisi di codice, simulazione, interfaccia, rete, salvataggi, PWA e pubblicazione. Corretti i problemi descritti sotto e aggiunti **41 test automatici senza dipendenze esterne**. Le modifiche sono locali: nessun commit, push o deploy eseguito.

Questo è un audit esteso, non una garanzia di assenza di altri bug. I confini delle verifiche sono indicati nella sezione finale.

## Bug corretti

| Priorità | Problema verificato | Correzione |
| --- | --- | --- |
| Alta | Il gancio chiamava `audio.playHook()`, che non esisteva. | Implementato il suono; direzione del gancio ricavata dai comandi del suo giocatore, anche online. |
| Alta | Danni superiori alla vita residua producevano HP negativi; il successivo `String.repeat()` dell'HUD poteva fermare il frame. | HP limitati a zero e rendering sicuro anche con mezzi punti vita. |
| Alta | La morte in campagna faceva rinascere il ninja prima del messaggio di fallimento; un timeout vecchio poteva interrompere un nuovo tentativo. | Fallimento immediato, niente respawn automatico in campagna, eliminato il timeout. |
| Alta | JSON corrotto o storage negato impedivano l'avvio; una partita peggiore sovrascriveva stelle e record. | Lettura e scrittura protette, validazione, mantenimento del massimo di stelle e del minimo tempo. |
| Alta | Movimento, timer e cooldown dipendevano dal numero di frame del monitor. | Simulazione a passo fisso di 60 Hz; rendering separato, recupero dei frame limitato dopo sospensioni. |
| Alta | Client e host simulavano entrambi danni, proiettili e raccolta monete; i client non ricevevano correttamente diversi effetti e fine partita. | Simulazione autorevole sull'host; snapshot con proiettili, energia, cooldown, modifiche alle tessere, countdown, pausa e risultato. |
| Alta | Terzo e quarto client ricevevano un ID ma la partita rimaneva da due giocatori. | Numero di slot aggiornato con gli ingressi; ingressi a partita iniziata rifiutati. |
| Alta | Cambio host/client, errori e uscita dal menu lasciavano connessioni e input precedenti attivi. | Chiusura completa, timeout di connessione, callback obsolete ignorate, bot al posto dei client usciti. |
| Alta | Messaggi client non validati potevano provocare eccezioni o valori fisici non validi. | Controllo di input e poteri, whitelist dei dati applicati, nomi di lobby non inseriti come HTML esterno, dizionario connessioni senza prototipo. |
| Media | WASD e tasti energia controllavano contemporaneamente più ninja locali. | Tasti separati; alias limitati a singolo/online. Assegnazioni visibili nel setup. |
| Media | Tasti rimanevano premuti dopo perdita del focus; Escape ripetuto alternava continuamente pausa/ripresa. | Rilascio input su blur/visibilità/menu, esclusione dei campi di testo, filtro dei keydown ripetuti. |
| Media | Il respawn conservava picchiata, gancio, attacco e stato dei tasti. | Reset coerente dello stato transitorio del giocatore. |
| Media | Il countdown era decorativo: la partita cominciava mentre comparivano i numeri. | Stato di countdown reale, cancellato quando si esce dal match. |
| Media | In Gold Rush le uccisioni aumentavano il contatore monete, i pareggi premiavano P1 e la generazione poteva fallire o sovrapporre monete. | Punteggi distinti, pareggio esplicito, scelta fra posizioni disponibili senza duplicati. |
| Media | La mappa casuale poteva essere diversa sui client; per Sky venivano applicati limiti errati e P3/P4 nascevano sotto le piattaforme. | Mappa risolta una sola volta dall'host, chiave attiva separata, spawn Sky corretti. |
| Media | Il Dash prometteva invulnerabilità ma non la applicava ai danni/trappole. | Invulnerabilità coerente durante il Dash. |
| Media | HUD e pulsanti si sovrapponevano su mobile e anche nell'intestazione desktop. | Righe flessibili, griglie responsive, pulsante pausa touch, rimozione HUD e controlli residui nei menu. |
| Media | Un errore CDN invalidava l'intero precache; l'activate eliminava cache di altre app; alcune richieste offline restituivano `undefined`. | Precache solo dell'app, cache separata per scope, aggiornamenti con lifetime garantito, risposta offline valida. HTML aggiornato dalla rete quando disponibile. |
| Media | `deploy.bat` controllava male gli errori dentro i blocchi e annunciava un deploy riuscito dopo un push fallito; URL finale costruito con un utente di fallback. | Controlli `if errorlevel`, stop sugli errori e su branch diverso da `main`, URL ricavati dalla repository e distinzione fra push e pubblicazione. |

Inoltre: audio inizializzato senza bloccare il gioco se non disponibile, ripresa dei contesti sospesi, gestione del rifiuto della clipboard, livelli selezionabili con pulsanti accessibili, test obbligatori nel workflow e artifact di pubblicazione limitato ai file pubblici.

## Verifiche effettuate

| Verifica | Copertura ed esito |
| --- | --- |
| `npm test` | 41 test: logica di gioco in un contesto Node isolato, DOM/audio/PeerJS simulati, service worker con Cache API simulata. |
| Campagna | Tutte le 10 mappe: spawn non solido, un interruttore e un'uscita. Record, morte, ripartenza e storage guasto testati. |
| Arene | Tutte le 5 mappe: 1.800 tick ciascuna con quattro bot, casualità deterministica, rendering richiamato e posizioni finite. |
| Refresh monitor | A 30, 60 e 144 frame/s simulati si ottengono gli stessi 60 tick e un secondo di timer. |
| Multiplayer automatico | Slot fino a quattro, input non validi, errori/timeout, snapshot di armi/HUD/tessere, pausa, vittoria, riavvio client e mappa casuale. |
| Browser reale | Avvio, selezione campagna, setup locale a quattro giocatori, countdown, HUD, pausa/ripresa e ritorno al menu. Provato layout mobile 390×844 e desktop; nessun overflow orizzontale rilevato nell'intestazione campagna e nel setup locale mobile. |
| Due schede WebRTC reali | Creazione stanza, connessione, avvio su mappa casuale, stato condiviso, pausa/ripresa dell'host, menu del client, uscita e subentro bot. Connessioni di test chiuse al termine. |
| Console browser | Nessun errore o warning rilevato nelle letture effettuate durante i flussi online provati. |
| Git | `git diff --check` per errori di whitespace. |

## Come lo migliorerei: ordine consigliato

### 1. Separare il codice in moduli

`index.html` contiene interfaccia, fisica, mappe, audio e rete in quasi 5.000 righe. Dividerei almeno `simulation`, `input`, `network`, `audio`, `ui` e `levels`, mantenendo i test attuali come protezione durante l'estrazione. È il miglior investimento per aggiungere funzioni senza introdurre regressioni.

### 2. Migliorare i bot e la progressione didattica

I bot inseguono il bersaglio ma non usano effettivamente poteri o onde energetiche: `updateBotLogic()` lascia `pow` falso e non genera comandi di carica/sparo. Aggiungerei scelta del percorso fra piattaforme, uso dei poteri, evitamento delle trappole e tre difficoltà.

Rivedrei anche gli obiettivi dei livelli: nel livello 3 il tunnel alto 24 px lascia passare il ninja alto 22 px in piedi, quindi non insegna davvero la scivolata. Nel livello 5 la descrizione parla di tempismo dei laser, ma il controllo delle trappole non prevede finestre di spegnimento. Mostrerei la descrizione del livello e un suggerimento contestuale dopo morti ripetute.

### 3. Rendere il multiplayer più fluido e diagnosticabile

La correzione garantisce un'unica simulazione, ma le posizioni dei client vengono ancora assegnate direttamente dagli snapshot, inviati ogni due tick. Il passo successivo è un buffer di interpolazione, indicatori di latenza/disconnessione e versione esplicita del protocollo. Poi proverei Wi-Fi/rete mobile e configurazione ICE/TURN: nel progetto non c'è una configurazione TURN esplicita. Migrazione dell'host e riconnessione a partita iniziata richiedono un progetto separato.

### 4. Migliorare la giocabilità mobile

Il layout non si sovrappone più, ma in verticale l'intera mappa 960×528 viene ridotta molto. Valuterei una camera più vicina in campagna, un layout dedicato al landscape, controlli riposizionabili e dimensioni regolabili. Aggiungerei rimappatura tastiera, supporto gamepad e memorizzazione delle preferenze audio/tema/touch.

### 5. Ridurre il lavoro dell'interfaccia e degli effetti

L'HUD evita ora scritture identiche, ma durante cooldown e ricarica può ancora rigenerare molte stringhe e nodi. Creerei gli elementi una volta, aggiornando solo testo, barre e classi. Per dispositivi deboli: livello grafico ridotto, tetto alle particelle, riuso degli oggetti e cache del rendering statico delle tessere.

### 6. Completare la qualità PWA e la distribuzione

Aggiungerei icone PNG dedicate, inclusa una Apple touch icon, e una verifica di installazione/offline su Safari iOS e Chrome Android reali. Renderei la pubblicazione una procedura esplicita con scelta della visibilità della repository; lo script attuale conserva la creazione pubblica automatica se manca `origin`. Utile anche un changelog con versione mostrata nel menu per capire se due giocatori hanno la stessa build.

## Limiti e rischi residui

- Non completati manualmente tutti e dieci i livelli: presenza di spawn/interruttore/uscita non dimostra che ogni percorso sia equilibrato o completabile con tutti i comandi.
- Le prove WebRTC reali usano due schede sulla stessa macchina, non dispositivi dietro NAT/reti differenti. Non misurati perdita di pacchetti o latenza WAN.
- I test offline usano una Cache API simulata; non è stata effettuata una prova completa in modalità aereo su dispositivi fisici.
- Le misure a 30/60/144 Hz verificano la logica temporale, non costituiscono un benchmark FPS su hardware reale.
- `deploy.bat` e il workflow sono stati controllati staticamente, senza eseguire commit, push, creazione repository o GitHub Actions remoto.
- Il protocollo di rete è cambiato: prima della prossima partita online occorre ricaricare entrambi i client. Nessuna promessa di compatibilità con schede che eseguono il codice precedente.

Le priorità sopra sono valutazioni tecniche basate sul codice e sulle prove, non funzioni già implementate.
