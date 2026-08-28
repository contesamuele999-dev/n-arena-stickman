# N+ Arena Stickman

Platform/action game in HTML, Canvas e JavaScript: campagna di 10 livelli, cinque arene, Gold Rush e multiplayer PeerJS per 2–4 giocatori.

## Avvio e test

Serve Node.js 22 o successivo per gli strumenti di sviluppo. Non occorre installare pacchetti.

```sh
npm test
npm start
```

Il server locale apre il gioco all'indirizzo `http://127.0.0.1:8775`. La porta può essere cambiata con la variabile d'ambiente `PORT`. Il server espone solo i file pubblici del gioco, non i test o il repository.

Il gioco pubblicato rimane un sito statico: non richiede Node.js sul server.

## Comandi

| Giocatore locale | Movimento e salto | Attacco | Potere | Carica | Onda |
| --- | --- | --- | --- | --- | --- |
| P1 | Frecce | M | N | C | V |
| P2 | WASD | F | G | Q | E |
| P3 | IJKL | ; | ' | O | P |
| P4 | Tastierino 4/6/8/2 | Num 7 | Num 9 | Num 1 | Num 3 |

In singolo, oppure con soli avversari bot, P1 può usare anche WASD, F/G, B/J. Online ciascun partecipante usa i comandi P1 con questi stessi alias. Le assegnazioni locali sono mostrate nelle schede dei giocatori.

Escape oppure il pulsante Pausa apre il menu. Su dispositivi touch ci sono comandi dedicati. La fisica avanza a 60 tick al secondo indipendentemente dal refresh del monitor; il countdown blocca la simulazione prima dell'avvio.

## Multiplayer

Un giocatore crea la stanza e condivide il codice. L'host simula la partita e invia lo stato ai client; l'ingresso di ulteriori giocatori amplia automaticamente la partita fino a quattro posti. Un giocatore disconnesso viene sostituito da un bot.

Solo l'host può mettere in pausa tutta la partita e avviare una rivincita. Il menu di un client interrompe i suoi comandi ma non ferma la partita. Quando la scheda dell'host viene nascosta, la partita va in pausa. L'uscita dell'host termina la sessione: non è prevista la migrazione dell'host. Non si entra in una partita già iniziata.

Il multiplayer richiede internet, PeerJS e una connessione WebRTC funzionante. Dopo un aggiornamento, entrambi i giocatori devono ricaricare l'app prima di creare una nuova stanza.

## Salvataggi e offline

Stelle massime e miglior tempo della campagna sono conservati nel browser. Se lo storage è disabilitato, si può giocare, ma i progressi durano solo per la sessione corrente e il completamento mostra un avviso.

Dopo una prima visita online con installazione del service worker, campagna e modalità locali funzionano anche offline. Font e libreria multiplayer sono risorse opzionali esterne. L'installabilità su iOS/Android richiede ancora una verifica su dispositivi fisici.

## Pubblicazione

Il workflow `.github/workflows/static.yml` esegue i test su push/PR e pubblica su GitHub Pages solo dopo il loro successo su `main`. L'artifact contiene esclusivamente HTML, service worker, manifest, favicon e `.nojekyll`.

`deploy.bat` esegue commit e push. **Prima di usarlo, controllare remote e modifiche:** aggiunge tutti i file al commit e, se manca `origin`, conserva la procedura originale di creazione di una repository pubblica. Il messaggio finale conferma il push, non il completamento del workflow remoto.

L'audit e il piano dei miglioramenti sono in `DEBUG_REPORT.md`. Nessun commit, push o deploy è stato eseguito durante l'audit.
