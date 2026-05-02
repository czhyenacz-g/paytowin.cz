  ---                                                                                                                                              
Název problému: Online lobby bot — fáze 2 automatické tahy
                                                                                                                                                   
---                                                                                                                                              
Jak přesně funguje rollDice (kritické nálezy)

Ownership check: NEEXISTUJE v rollDice samotném.                                                                                                 
rollDice se spoléhá výhradně na UI gate — isMyTurn podmínka v GamePanel.tsx, která zabraňuje zobrazení tlačítka. Funkce sama nijak neověřuje     
myPlayerId === currentPlayer.id.

Guards na začátku rollDice (GameBoard.tsx:809-814):                                                                                              
!gameState | pendingRacer | pendingCard | pendingOffer |  
pendingRollDecision | activePendingRace | activePendingBankrupt |                                                                                
activePendingRacePlaceholder | activePendingStableDuel |                                                                                         
isRolling | isMoving | bankruptWarning

FIELDS v rollDice: Používá lokální const FIELDS (line 341), ne fieldsRef.current. Ref se používá jen uvnitř applyCardEffect pro stale closure.   
Server action musí zavolat buildFields() přímo.

pendingRollDecision: Promise-based pattern s 3s auto-resolve na adjustment=0. Bot vždy použije 0 — tohle celé přeskočíme.

Pohyb hráče: newPosition = (oldPosition + roll) % fieldCount. START crossing = (oldPosition + roll) >= fieldCount. Max 1 crossing pro běžný hod.

card_pending pro boty — klíčový problém:                                                                                                         
GameBoard.tsx má useEffect timer, který po 7s zavolá applyCardEffect() když je nastaveno pendingCard. Pokud server action nastaví card_pending do
DB, tento timer se spustí pro všechny klienty → double-execute. Řešení: server action pro bota nikdy nenastaví card_pending — karta se aplikuje
ihned.

finishTurn DB write (game_state tabulka):                                                                                                        
current_player_index, turn_count, horse_pending=false,
card_pending=null, log, last_roll?, bust_order?, year_event_telegram?
- paralelně: players stamina regen (+10 cap) + active_effects decrement pro current playera.

game_state.updated_at: Auto-managed Postgresem, NOT v Update typech. Nelze ho přepsat z aplikace. Použijeme turn_count jako guard místo toho.
                                                                                                                                                   
---                                                                                                                                              
Navržené soubory

lib/bot/
botDecision.ts          (~70 řádků)  — pure funkce, žádný DB, žádný React

app/game/
bot-actions.ts          (~220 řádků) — 2 server actions

app/components/
GameBoard.tsx           (+~22 řádků) — pouze trigger v Realtime handleru
                                                                                                                                                   
---
Přesný návrh funkcí

lib/bot/botDecision.ts

// Vše pure — žádné side effects, žádný Supabase

export function decideBotHorsePurchase(                                                                                                          
player: Player,                                                                                                                                
racer: Horse                                            
): "buy" | "skip"
// Pravidla:                                                                                                                                     
// - 0 koní && může si dovolit (zachová ≥25% reserve) → "buy"
// - <2 koní && může si dovolit && random() > 0.15 → "buy"                                                                                       
// - jinak → "skip"

export function decideBotCardApply(                                                                                                              
card: GameCard                                                                                                                                 
): "apply"                                                
// Bot vždy aplikuje kartu — žádná choice
// Vrací "apply" (zatím triviální, ale typ pomáhá pro budoucí rozšíření)
                                                                                                                                                   
---                                                                                                                                              
app/game/bot-actions.ts

"use server";

// ── Helper (interní, neexportovaný) ────────────────────────────────                                                                           
async function fetchBotContext(gameId: string): Promise<{
game: { id, economy, theme_id, board_id, fog_of_war },                                                                                         
state: GameState,                                       
players: Player[],                                                                                                                             
botPlayer: Player,
botIndex: number,                                                                                                                              
FIELDS: Field[],                                        
} | null>
// Načte game + game_state + players z Supabase
// Zavolá buildFields(board, themeRacers, economy) server-side
// Vrátí null pokud current player není bot

// ── Akce 1 ─────────────────────────────────────────────────────────
export async function executeBotTurnAction(                                                                                                      
gameId: string,                                         
expectedTurnCount: number
): Promise<void>
// Guard: state.turn_count !== expectedTurnCount → return (stale call)
// Guard: pending stavy → return                                                                                                                 
// Roll 1-6
// Vypočítá newPosition + počet START crossingů                                                                                                  
// Aplikuje subsidy/tax za START                                                                                                                 
// Podle field.type:                                                                                                                             
//   "racer" bez ownera         → set horse_pending=true, return                                                                                 
//   "racer" s ownerem          → zaplatí rent, finishTurn                                                                                       
//   "racer" own player owns it → jen finishTurn (already owned)                                                                                 
//   "chance"/"finance"/"mafia" → drawCard + applyBotCardEffect, finishTurn                                                                      
//   ostatní                    → zavolá field.action(botPlayer), finishTurn                                                                     
//   Unsupported/fallback        → logguje warning, finishTurn (bez efektu)

// ── Akce 2 ─────────────────────────────────────────────────────────                                                                           
export async function executeBotHorseDecisionAction(                                                                                             
gameId: string,                                         
expectedTurnCount: number
): Promise<void>                                                                                                                                 
// Guard: state.turn_count !== expectedTurnCount → return
// Guard: state.horse_pending !== true → return                                                                                                  
// Guard: current player není bot → return                
// Načte field.racer z aktuální pozice                                                                                                           
// Zavolá decideBotHorsePurchase()                                                                                                               
// "buy"  → update player.coins + player.horses, finishTurn                                                                                      
// "skip" → finishTurn přímo

// ── Interní helper ──────────────────────────────────────────────────
async function botFinishTurn(params: {
gameId: string,                                                                                                                                
state: GameState,
players: Player[],                                                                                                                             
updatedBotPlayer: Player,                               
botIndex: number,                                                                                                                              
log: string[],
lastRoll?: number,                                                                                                                             
}): Promise<void>                                         
// Replikuje kritické části finishTurn:
//   getNextActiveIndex() → nextIndex                                                                                                            
//   game-over check (≤1 non-bankrupt)                                                                                                           
//   game_state UPDATE: current_player_index, turn_count+1, horse_pending=false,                                                                 
//                      card_pending=null, offer_pending=null, log, last_roll?                                                                   
//   players UPDATE: stamina regen +10 (capped), active_effects decrement                                                                        
//   Pokud game over: games UPDATE status="finished"
                                                                                                                                                   
---                                                                                                                                              
DB zápisy server action

executeBotTurnAction — normální pole (ne racer):
players UPDATE:  coins, position, laps (pokud START crossed)                                                                                     
game_state UPDATE: current_player_index=nextIndex, turn_count+1,
horse_pending=false, card_pending=null,                                                                                       
offer_pending=null, log, last_roll=roll                                                                                       
players UPDATE:  horses (stamina regen), active_effects (decay)

executeBotTurnAction — racer pole bez ownera:                                                                                                    
game_state UPDATE: horse_pending=true, turn_count+1, last_roll=roll,                                                                             
log  [tah NESKONČÍ, čeká se na horse decision]

executeBotTurnAction — racer pole s ownerem (rent):                                                                                              
players UPDATE:  bot.coins -= rent                                                                                                               
players UPDATE:  owner.coins += rent                                                                                                             
game_state UPDATE: current_player_index=nextIndex, turn_count+1, ...

executeBotHorseDecisionAction — buy:                                                                                                             
players UPDATE: coins -= racer.price, horses = [...horses, racer]
game_state UPDATE: current_player_index=nextIndex, turn_count+1,                                                                                 
horse_pending=false, log

executeBotHorseDecisionAction — skip:                                                                                                            
game_state UPDATE: current_player_index=nextIndex, turn_count+1,                                                                                 
horse_pending=false, log
                                                                                                                                                   
---
Jak se hlídá double-execute

Level 1 — client ref (botTurnScheduledRef):
// Zabrání vícenásobnému setTimeout z jednoho klienta                                                                                            
// Reset až po dokončení server action (v finally bloku)  
const botTurnScheduledRef = React.useRef(false);

Level 2 — server turn_count guard:                                                                                                               
// Server re-fetchuje state TĚSNĚ PŘED zápisem                                                                                                   
const freshState = await fetchState(gameId);                                                                                                     
if (freshState.turn_count !== expectedTurnCount) return; // stale

Level 3 — is_bot + pending check:                                                                                                                
const currentPlayer = players[freshState.current_player_index];
if (!currentPlayer?.is_bot) return;           // jiný hráč na tahu                                                                               
if (freshState.horse_pending) return;         // pro executeBotTurnAction                                                                        
if (freshState.card_pending) return;          // karta čeká                                                                                      
if (freshState.offer_pending) return;         // complex pending

Level 4 — DB SERIALIZABLE nebo optimistic:                                                                                                       
Pro MVP stačí Level 1–3. Při nejhorším případě (dvě race condition volání) druhé volání selže na turn_count guard (první stihlo zvýšit           
turn_count). Žádná data se nepokazí.
                                                                                                                                                   
---                                                                                                                                              
Pending stavy — MVP rozsah

Podporované ✅

┌───────────────────────────────────────────┬───────────────────────────────────────┐                                                            
│                   Stav                    │              Jak bot reaguje              │
├───────────────────────────────────────────┼───────────────────────────────────────────┤                                                        
│ Žádný pending (normální tah)              │ Hodí kostkou, pohne se, aplikuje pole         │
├───────────────────────────────────────────┼───────────────────────────────────────────────┤
│ horse_pending (racer pole)                │ decideBotHorsePurchase — buy/skip             │                                                    
├───────────────────────────────────────────┼───────────────────────────────────────────────┤                                                    
│ Karta coins/move/skip_turn/stamina_debuff │ Aplikuje okamžitě, bez card_pending           │                                                    
├───────────────────────────────────────────┼───────────────────────────────────────────────┤                                                    
│ START crossing                            │ Aplikuje subsidy + tax + laps++               │
├───────────────────────────────────────────┼───────────────────────────────────────────────┤                                                    
│ Racer pole s ownerem → rent               │ Zaplatí rent (nikdy nevyvolá stable duel)     │
├───────────────────────────────────────────┼───────────────────────────────────────────────┤                                                    
│ Bankrupt (coins ≤ 0)                      │ Označí jako bankrupt (bust_order), finishTurn │
└───────────────────────────────────────────┴───────────────────────────────────────────────┘

Nepodporované — bezpečné zastavení ⛔                                                                                                            ─

┌────────────────────────────────┬────────────────────────────────────────────────────────────┐                                                  
│              Stav              │                        Chování bota                        │
├────────────────────────────────┼────────────────────────────────────────────────────────────┤                                                  
│ offer_pending (reroll nabídka) │ Ignoruje reroll, zavolá finishTurn bez efektu              │
├────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ card_pending.give_racer        │ Bot karta give_racer se přeskočí, finishTurn + log warning │                                                  
├────────────────────────────────┼────────────────────────────────────────────────────────────┤                                                  
│ stable_duel trigger            │ Bot vždy platí rent místo vyvolání duelu                   │                                                  
├────────────────────────────────┼────────────────────────────────────────────────────────────┤                                                  
│ race_pending event             │ Bot auto-přeskočí, finishTurn                              │
├────────────────────────────────┼────────────────────────────────────────────────────────────┤                                                  
│ pendingRollDecision UI         │ Server action vždy použije adjustment=0                    │
├────────────────────────────────┼────────────────────────────────────────────────────────────┤                                                  
│ Fog of War update              │ Přeskočen (TODO v kódu), pozice se aktualizuje správně     │
├────────────────────────────────┼────────────────────────────────────────────────────────────┤                                                  
│ Bankrupt confirmation dialog   │ Bot se rovnou stane bankrotním, žádný dialog               │
└────────────────────────────────┴────────────────────────────────────────────────────────────┘
                                                            
---                                                                                                                                              
GameBoard.tsx — přesný přírůstek

+1 ref (1 řádek) — u ostatních refs:
const botTurnScheduledRef = React.useRef(false);

+1 import (1 řádek):                                                                                                                             
import { executeBotTurnAction, executeBotHorseDecisionAction } from "@/app/game/bot-actions";

+18 řádků v existujícím Realtime game_state UPDATE handleru (za horse_pending blokem):

// Bot turn trigger — spouští pouze game owner, aby se zabránilo souběhu                                                                         
const botCurrentPlayer = freshPlayers[freshState.current_player_index];                                                                          
const isGameOwner = !isLocalGame && freshPlayers[0]?.id === myPlayerId;

if (botCurrentPlayer?.is_bot && isGameOwner && !botTurnScheduledRef.current) {
botTurnScheduledRef.current = true;                                                                                                            
const delay = 900 + Math.random() * 1100;

    if (freshState.horse_pending) {                                                                                                                
      setTimeout(async () => {                                                                                                                     
        try { await executeBotHorseDecisionAction(gameId!, freshState.turn_count); }                                                               
        finally { botTurnScheduledRef.current = false; }                                                                                           
    } else if (!freshState.card_pending && !freshState.offer_pending) {
      setTimeout(async () => {                                                                                                                     
        try { await executeBotTurnAction(gameId!, freshState.turn_count); }                                                                        
        finally { botTurnScheduledRef.current = false; }                   
      }, delay);                                                                                                                                   
    } else {                                                
      botTurnScheduledRef.current = false; // nepodporovaný pending, uvolni ref                                                                    
    }                                                                          
}

Celkem GameBoard.tsx: +20 řádků (1 ref + 1 import + 18 v handleru).
                                                                                                                                                   
---
Rizika

┌───────────────────────────┬───────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┐
│          Riziko           │ Závažnost │                                              Poznámka                                              │   
├───────────────────────────┼───────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ buildFields server-side — │ střední   │ Ověřit, jestli board je deterministický nebo uložený v DB. Pokud je shuffle random při každém      │   
│  shuffled board           │           │ buildFields, bot vidí jiný board než client → špatné field typy. Nejdřív ověřit.                   │
├───────────────────────────┼───────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤   
│ drawCard deck konzistence │ nízká     │ Bot i client kreslí karty nezávisle. Pro MVP nevadí — log stále zaznamenává kartu.                 │
├───────────────────────────┼───────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤   
│ Game owner odejde         │ střední   │ Bot přestane hrát. Fallback: jiní klienti mohou detekovat bot turn a spustit action (fáze 3).      │
├───────────────────────────┼───────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤   
│ Bankrupt bota uprostřed   │ nízká     │ botFinishTurn zkontroluje game-over, nastaví status="finished". Žádný UI dialog.                   │
│ tahu                      │           │                                                                                                    │   
├───────────────────────────┼───────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ START crossing tax        │ nízká     │ Nutno replikovat přesnou formuli z rollDice. Špatná implementace = wrong coins. Priorita: ověřit   │
│ výpočet                   │           │ formuli z GameBoard.tsx před implementací.                                                         │   
├───────────────────────────┼───────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Supabase RLS pro server   │ střední   │ Server action používá anonymní Supabase client nebo service role key. Ověřit, že RLS policies      │   
│ action                    │           │ dovolují server-side UPDATE bez auth tokenu.                                                       │   
└───────────────────────────┴───────────┴────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                                                                   
---                                                       
Implementační kroky v pořadí

Krok 1 — Ověřit buildFields server-side kompatibilitu     (~30 min, audit only)
├── Zjistit, kde se generuje "shuffledBoard" v GameBoard.tsx                                                                                   
├── Je board uložen v DB při createGame? Nebo se generuje z board_id deterministicky?                                                          
└── Pokud deterministický → buildFields server-side funguje

Krok 2 — botDecision.ts                                    (~45 min)                                                                             
├── decideBotHorsePurchase() s buy/skip pravidly        
└── npx tsc --noEmit

Krok 3 — bot-actions.ts základní kostra                    (~30 min)                                                                             
├── fetchBotContext helper                                                                                                                     
├── botFinishTurn helper (bez stamina regen zatím)                                                                                             
└── npx tsc --noEmit

Krok 4 — executeBotTurnAction — normální pole              (~60 min)                                                                             
├── Roll + pohyb + START crossing                                                                                                              
├── field.type !== "racer" → field.action() + botFinishTurn                                                                                    
├── Karta → okamžitá aplikace + botFinishTurn                                                                                                  
└── npx tsc --noEmit

Krok 5 — executeBotTurnAction — racer pole                 (~45 min)                                                                             
├── Bez ownera → horse_pending = true                   
├── S ownerem → rent + botFinishTurn                                                                                                           
└── npx tsc --noEmit

Krok 6 — executeBotHorseDecisionAction                     (~30 min)                                                                             
├── Guard + decideBotHorsePurchase
├── Buy/skip + botFinishTurn                                                                                                                   
└── npx tsc --noEmit

Krok 7 — botFinishTurn stamina regen + effects             (~30 min)                                                                             
├── +10 stamina per horse (capped)                      
├── active_effects decrement                                                                                                                   
└── npx tsc --noEmit

Krok 8 — GameBoard.tsx trigger                             (~30 min)                                                                             
├── botTurnScheduledRef                                 
├── Import server actions                                                                                                                      
├── ~18 řádků v Realtime handleru
└── npx tsc --noEmit

Krok 9 — E2E test lokálně                                  (~45 min)                                                                             
├── Založ hru 1 člověk + 1 bot                          
├── Sleduj, jestli bot hraje automaticky                                                                                                       
├── Test: racer pole → bot koupí/přeskočí                                                                                                      
├── Test: karta → bot aplikuje okamžitě                                                                                                        
└── Test: bot přežije bankrot / game over

Celkový odhad: ~6 hodin implementace, ~300 nových řádků v nových souborech, +20 řádků v GameBoard.tsx.   