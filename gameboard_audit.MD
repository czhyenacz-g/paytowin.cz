  ---                                                                                                                                                                      
GameBoard.tsx — audit map

Soubor: 4593 řádků. Jeden monolitický React component mixing DB sync, herní logiku, rendering a dev nástroje.
                                                                                                                                                                           
---                                                       
Oblast 1 — Top-level konstanty a layout data

Řádky: 1–415
Obsah: Importy, FIELD_POSITIONS, FIELD_POSITIONS_STADIUM, FIELD_ROTATIONS_STADIUM, FIGURINE_POSITIONS, FIGURINE_POSITIONS_STADIUM, DICE_DOTS, čisté field helpery        
(getFieldDetail, getFieldMetaLabel, getFieldAccentColor, getFieldTone), DiceFace, AmbientBackground                                                                      
Závislosti: board/theme typy; žádný game state
Riziko extrakce: NÍZKÉ — čisté funkce a data bez closures                                                                                                                
Cíl: lib/board/layout.ts (pozice), app/components/board/FieldHelpers.ts (čisté helpery)                                                                                  
První krok: Přesunout 5 FIELD_POSITIONS_* / FIGURINE_POSITIONS_* konstantních polí do lib/board/layout.ts, importovat zpátky.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 2 — useState a useRef deklarace

Řádky: 419–520
Obsah: ~50 useState + ~20 useRef                                                                                                                                         
Závislosti: Vše — každá oblast to potřebuje                                                                                                                              
Riziko extrakce: VELMI VYSOKÉ — nelze extrahovat samostatně; blokující pro ostatní                                                                                       
Cíl: Zatím ponechat; extrahují se průběžně s hookuváváním ostatních oblastí                                                                                              
První krok: Přidat komentářové skupiny (// ── Audio ──, // ── Stable Duel ──, atd.) — nulové riziko, zlepší orientaci.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 3 — Audio systém

Řádky: 520–743
Obsah: audioCtxRef, soundEnabledRef, toggleSound, playStepSound, playSfx, sound-preference useEffect                                                                     
Závislosti: Žádné DB; jen refs a AudioContext API                                                                                                                        
Riziko extrakce: STŘEDNÍ — refs žijí v GameBoard; extrakce jako custom hook je bezpečná                                                                                  
Cíl: hooks/useGameAudio.ts — vrací { playSfx, playStepSound, soundEnabled, toggleSound }                                                                                 
První krok: Extrahovat playSfx + playStepSound jako standalone funkce přijímající ctx parametr (mimo React) — první krok před hookem.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 4 — Telegram/notifikační useEffects

Řádky: 744–869
Obsah: Race sound (748–752), year event telegram (757–764), game over telegram (768–774), late-join (778–784), join player (788–805)                                     
Závislosti: gameState, players, viewerRole, playSfx, showTelegram (callbacks)                                                                                            
Riziko extrakce: STŘEDNÍ — read-only watchers bez DB zápisů                                                                                                              
Cíl: hooks/useGameNotifications.ts                                                                                                                                       
První krok: Extrahovat join-player telegram useEffect jako proof-of-concept; nejmenší ze skupiny.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 5 — DB loading a Realtime subscriptions

Řádky: 807–941
Obsah: loadGame, refreshGame, Realtime channel setup
Závislosti: supabase, gameCode, desítky setterů                                                                                                                          
Riziko extrakce: VYSOKÉ — nastavuje většinu state; silně svázané s ostatními stery                                                                                       
Cíl: hooks/useGameSession.ts                                                                                                                                             
První krok: Izolovat refreshGame jako pure async funkci přijímající id a vracející data — žádné React deps uvnitř funkce samotné.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 6 — Feedback helpers

Řádky: 943–1021
Obsah: showCoinsFeedback, showTelegram, showFlash, openStableDuelOverlay, confirmBankruptOrSell                                                                          
Závislosti: Settery, refs pro timery, overlayOpenedRef                                                                                                                   
Riziko extrakce: STŘEDNÍ                                                                                                                                                 
Cíl: hooks/useGameFeedback.ts                                                                                                                                            
První krok: showTelegram extrahovat jako standalone funkci přijímající setter + audioCtxRef — čistá, bez closures.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 7 — rollDice (~400 řádků)

Řádky: 1023–1413
Obsah: Celý dice-roll turn handler. Tři větve: racer pole (vlastní/rent/stable duel/koupě pending), karta, normální pole. Každá větev píše do DB a volá finishTurn.
Závislosti: gameState, players, FIELDS (přes ref), gameId, finishTurn, confirmBankruptOrSell, openStableDuelOverlay, ~15 setterů                                         
Riziko extrakce: VELMI VYSOKÉ — největší funkce, stale closure riziko, DB write pořadí je kritické
Cíl: Interní refactor nejdřív (pojmenované sub-funkce pro větve), pak hook                                                                                               
První krok: Extrahovat animaci pohybu (řádky ~1079–1113) do pojmenované async helper funkce animatePlayerMove(from, steps, setters) — žádné DB zápisy, čistá animace.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 8 — Racer purchase/sale

Řádky: 1415–1513
Obsah: buyRacer, sellRacerToBank, setPreferredRacer, skipRacer
Závislosti: pendingRacer, gameState, players, supabase, finishTurn                                                                                                       
Riziko extrakce: STŘEDNÍ — 4 oddělené funkce s jasnými hranicemi                                                                                                         
Cíl: hooks/useRacerActions.ts                                                                                                                                            
První krok: setPreferredRacer — 10 řádků, jen DB write, žádný finishTurn; nejjednodušší extrakce ze skupiny.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 9 — applyCardEffect (~260 řádků)

Řádky: 1570–1832
Obsah: Všechny typy karet (coins, move, skip_turn, give_racer, stamina_debuff), ref pattern pro čerstvé volání, auto-apply timer                                         
Závislosti: gameState, players, gameId, finishTurn, confirmBankruptOrSell, showTelegram                                                                                  
Riziko extrakce: STŘEDNÍ-VYSOKÉ — stale closure risk; ref pattern musí být zachován                                                                                      
Cíl: hooks/useCardEffect.ts                                                                                                                                              
První krok: Extrahovat give_racer branch logiku (1671–1723) jako pure funkci resolveGivenRacer(player, card, fields, players) vracející { chosen, usedFallback } — žádné
DB, žádný state.
                                                            
---                                                                                                                                                                      
Oblast 10 — finishTurn (~140 řádků)

Řádky: 1845–1988
Obsah: POST-TURN HOOK dispatch (announcement, race_pending, normální), stamina regen, active effects decrement                                                           
Závislosti: gameId, gameState, players, supabase                                                                                                                         
Riziko extrakce: STŘEDNÍ — izolovaná funkce; stale closure nad players/gameState musí být řešen                                                                          
Cíl: lib/game/finishTurn.ts nebo server action/RPC                                                                                                                       
První krok: Typovat params objekt jako export interface FinishTurnParams — žádná funkční změna, zlepší refactor v dalších krocích.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 11 — Race flow

Řádky: 2025–2271
Obsah: closeRacePending, closeRaceResult, submitRaceSelection, submitPendingRaceScore, startRace, submitRaceScore, closeRace
Závislosti: gameId, gameState, players, supabase                                                                                                                         
Riziko extrakce: STŘEDNÍ — 7 funkcí, všechny sdílejí gameState a gameId                                                                                                  
Cíl: hooks/useRaceFlow.ts                                                                                                                                                
První krok: startRace — čte players, zapíše jeden DB update; nejjednodušší ze skupiny.
                                                                                                                                                                           
---                                                       
Oblast 12 — Stable Duel flow

Řádky: 2311–2578
Obsah: handleStableDuelFinish (~120 řádků, settlement + online_1v1 delayed cleanup), handleDefenderReady, handleFallbackToPvBot, countdown useEffects                    
Závislosti: stableDuelCtx, players, myPlayerId, gameId, gameState, finishTurn, openStableDuelOverlay                                                                     
Riziko extrakce: VYSOKÉ — handleStableDuelFinish má setTimeout s DB re-fetch; multiple mode branches                                                                     
Cíl: hooks/useStableDuel.ts                                                                                                                                              
První krok: handleDefenderReady — 20 řádků, jeden DB update, žádný finishTurn; bezpečné odtržení.
                                                                                                                                                                           
---                                                       
Oblast 13 — Derived view model

Řádky: 2650–2832
Obsah: displayPlayers, fieldPlayers, isMyTurn, racePendingEvt, raceResults, rollDecisionOptions, racerOwnership, centerEvent; 4 useEffects (countdown, watchdog,
auto-confirm preferred, auto-skip)                                                                                                                                       
Závislosti: Veškerý state a theme
Riziko extrakce: NÍZKÉ pro čisté výpočty; auto-skip useEffect píše do DB — ponechat v GameBoard                                                                          
Cíl: hooks/useGameViewState.ts                                                                                                                                           
První krok: buildRollDecisionOptions(decision, FIELDS, currentPlayer) jako pure funkce mimo komponent.
                                                                                                                                                                           
---                                                       
Oblast 14 — Early return renders

Řádky: 2843–3015
Obsah: Loading, not-found, cancelled, finished (newspaper screen ~100 řádků), login_required
Závislosti: players, gameState, theme, supabase                                                                                                                          
Riziko extrakce: NÍZKÉ — čistě prezentační větve                                                                                                                         
Cíl: app/components/board/GameFinishedScreen.tsx, GameCancelledScreen.tsx, atd.                                                                                          
První krok: Extrahovat gameStatus === "finished" newspaper screen — největší, nejsamostatnější ze skupiny.
                                                                                                                                                                           
---                                                       
Oblast 15 — Board surface rendering

Řádky: 3017–3913
Obsah: Background, center modals, board surface (field cards loop, figurines, trail, ghost target, center circle, START info), stable duel status banners                
Závislosti: Veškerý state, theme, FIELDS                                                                                                                                 
Riziko extrakce: STŘEDNÍ — stateless prezentace ale velký prop drilling                                                                                                  
Cíl: app/components/board/BoardSurface.tsx (field cards + figurines), GameHUD.tsx, StableDuelBanners.tsx                                                                 
První krok: Field card loop (3512–3627) extrahovat jako FieldCardList — přijme FIELDS, displayPlayers, theme, hover callbacks; žádné akce.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 16 — Pravý panel (hráčské karty + kostka + akce)

Řádky: 3915–4408
Obsah: Guides, dice panel, action buttons (roll/buy/skip/card/bankrupt), player list s horse cards                                                                       
Závislosti: Všechny action handlery, veškerý player state, theme                                                                                                         
Riziko extrakce: STŘEDNÍ — event-driven; action buttons volají mnoho handlerů                                                                                            
Cíl: app/components/board/GamePanel.tsx                                                                                                                                  
První krok: Extrahovat 3 guide widgety (racerGuide, staminaGuide, preferredGuide) jako PlayerGuide — čistá prezentace, žádné action handlery.
                                                                                                                                                                           
---                                                       
Oblast 17 — Dev nástroje

Řádky: 3218–3289 (HUD tlačítka), 4411–4515 (shells)
Obsah: DEV-only tlačítka (Shell, Layer, Flip, Duel, Speed, Legendary, Stable, 1v1/PvBot), DevRaceModeShell, DevDuelShell, SpeedDevShell, LegendaryRaceDevShell           
Závislosti: Dev state settery, players, theme — vše gated přes process.env.NODE_ENV === "development"                                                                    
Riziko extrakce: NÍZKÉ                                                                                                                                                   
Cíl: app/components/board/DevToolbar.tsx, DevOverlays.tsx                                                                                                                
První krok: Extrahovat dev HUD tlačítka (3218–3289) jako DevToolbar — 70 řádků JSX, žádná logika, jen onClick props.
                                                                                                                                                                           
---                                                                                                                                                                      
Oblast 18 — Bottom-file helpery

Řádky: 4529–4593
Obsah: mapToCenterEvent (pure), resolveRacerDisplay (exported pure)                                                                                                      
Závislosti: Žádné React deps                                                                                                                                             
Riziko extrakce: NÍZKÉ — jen přesun souboru                                                                                                                              
Cíl: lib/game/viewModel.ts                                                                                                                                               
První krok: Přesunout oba jako je do lib/game/viewModel.ts, aktualizovat import.
                                                                                                                                                                           
---                                                                                                                                                                      
Doporučené pořadí extrakcí

┌────────┬─────────────────────────────────────────────────┬──────────────────────────────────────────┐
│ Pořadí │                      Akce                       │                   Proč                   │                                                                  
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
│ 1      │ lib/board/layout.ts — FIELD_POSITIONS konstanty │ Nulové riziko, nic nereferuje game state                 │
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
│ 2      │ DevToolbar + DevOverlays                        │ NODE_ENV guard, nulový dopad na produkci                 │                                                  
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 3      │ GameFinishedScreen                              │ Velký self-contained blok, read-only                     │                                                  
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 4      │ lib/game/viewModel.ts                           │ Přesun hotových pure funkcí                              │
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 5      │ buildRollDecisionOptions pure funkce            │ Snižuje délku view model sekce                           │
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 6      │ PlayerGuide component                           │ Čistá prezentace                                         │
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 7      │ useGameAudio hook                               │ Izolace audio bez DB                                     │
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 8      │ setPreferredRacer + startRace                   │ Nejjednodušší DB-only funkce, proof-of-concept hookování │
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 9      │ useRaceFlow                                     │ Logicky semknutá skupina                                 │
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 10     │ handleDefenderReady → useStableDuel             │ Vstupní bod; pak zbytek SD flow                          │
├────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤                                                  
│ 11     │ useGameSession                                  │ Největší risk; až ostatní extrakce uvolní prostor        │
└────────┴─────────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘
                                                            
---                                                                                                                                                                      
První nejbezpečnější refactor (ready-to-use prompt)

Přečti app/components/GameBoard.tsx řádky 101–250.

Extrahuj konstanty:                                       
FIELD_POSITIONS, FIELD_POSITIONS_STADIUM, FIELD_ROTATIONS_STADIUM,
FIGURINE_POSITIONS, FIGURINE_POSITIONS_STADIUM                                                                                                                         
do nového souboru lib/board/layout.ts.

V GameBoard.tsx nahraď jejich definice importem:          
import { FIELD_POSITIONS, FIELD_POSITIONS_STADIUM, FIELD_ROTATIONS_STADIUM,                                                                                            
FIGURINE_POSITIONS, FIGURINE_POSITIONS_STADIUM } from "@/lib/board/layout";

Neměň nic jiného v GameBoard.tsx.                                                                                                                                        
Po změně spusť npx tsc --noEmit a ověř výstup.
                                                                                                                                                                           
---
## Refactor progress

| # | Co | Cíl | Commit | Řádky |
|---|-----|-----|--------|-------|
| 1 | FIELD_POSITIONS, FIELD_POSITIONS_STADIUM, FIELD_ROTATIONS_STADIUM, FIGURINE_POSITIONS, FIGURINE_POSITIONS_STADIUM | lib/board/layout.ts | 364e1c0 | −110 |
| 2 | DEV tlačítka (Shell/Layer/Flip/Duel/Speed/Legendary/Stable/PvBot) | app/components/board/DevToolbar.tsx | 4b1a5e2 | −71 |
| 3 | finished screen (newspaper, ScoreTable, solo prohra) | app/components/board/GameFinishedScreen.tsx | ac50fbc | −90 |

**Původní počet řádků:** 4593
**Aktuální počet řádků:** 4359
**Celková úspora:** −234 řádků (−5 %)

---
Hlavní rizika (neopomíjet při jakékoli extrakci)

1. Stale closure — rollDice, applyCardEffect, finishTurn capturují players a gameState při volání. Extrakce bez správného threading hodnot způsobí turn-sequence bugy.
2. Ref forwarding — animatingPlayerIdRef, overlayOpenedRef, applyCardEffectRef, closeBankruptAnnouncementRef, submitPendingRaceScoreRef jsou idempotency guardy a        
   fresh-callback bridges. Extrakce bez refs tyto guardy přeruší.
3. Pořadí DB zápisů — mnohé handlery závisí na sekvenci players.update → game_state.update. Změna pořadí způsobuje Realtime race conditions.
4. finishTurn v stableDuelProceedRef — closure nastavená před async delay. Jakákoli změna identity finishTurn musí zachovat ref pattern.
5. FIELDS přes ref — async callbacky používají fieldsRef.current, ne state proměnnou. Extrakce action handlerů musí toto respektovat. 