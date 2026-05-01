⏺ Tady je kompletní audit a MVP návrh.
                                             
---                                                                                                                                              
Jak teď funguje online flow

Vytvoření hry (LandingPage.tsx:273-334):
- createGame() zapíše do tabulek games + players + game_state
- první player = owner, uloží se do localStorage
- status: waiting → hráči joinují přes kód

Join (LandingPage.tsx:336-429):
- joinGame() insertuje do players s turn_order = existingPlayers.length
- Při turn_count >= playerCount → spectator

Tah (GameBoard.tsx:691-726 Realtime + 808-1800 handlery):
- game_state.current_player_index určuje kdo hraje
- isMyTurn = currentPlayer.id === myPlayerId
- celý flow je klientský: hráč klikne → rollDice() → DB write → Realtime → ostatní vidí
- finishTurn() přepíše current_player_index → Realtime firing pro všechny klienty

Pending rozhodnutí:
- horse_pending: true v game_state = hráč musí koupit/přeskočit racera
- card_pending = čeká se na aplikaci karty
- Žádný auto-timeout neexistuje — pokud hráč odejde, hra visí

  ---                                                                                                                                              
Kde je existující bot logika

Jen v minihrách — není to player type:

┌───────────────────────────────────────┬───────────────────────────────────────────────────────────────┐
│                Soubor                 │                            Co dělá                            │                                        
├───────────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ lib/duel/simulate.ts:240-268          │ getBotInput() — greedy lookahead pro duelový had (PvBot)      │
├───────────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ app/components/duel/DuelArena.tsx:269 │ Při mode === "pvbot" volá getBotInput() místo vstupu hráče    │                                        
├───────────────────────────────────────┼───────────────────────────────────────────────────────────────┤                                        
│ lib/types/game.ts:194                 │ StableDuelPendingOffer.mode: "pvbot_awareness" | "online_1v1" │                                        
└───────────────────────────────────────┴───────────────────────────────────────────────────────────────┘

PvBot je duelový mode, ne player entity. Na players tabulce is_bot neexistuje nikde.
                                                            
---                                                                                                                                              
MVP návrh

Datový model — minimální změna

1 nová DB migrace:                                                                                                                               
-- supabase/migrations/20260501_players_add_is_bot.sql                                                                                           
ALTER TABLE players ADD COLUMN is_bot boolean DEFAULT false;

Typ update (lib/database.types.ts):                                                                                                              
players: {
// existující sloupce...                                                                                                                       
is_bot: boolean | null;  // +1 řádek                    
}

Žádná změna game_state, žádné nové tabulky.
                                                                                                                                                   
---                                                       
Vytvoření hry s botem

V LandingPage.tsx po insertu prvního hráče (line 314), pokud je zaškrtnut checkbox:

if (addBotPlayer) {                                       
await supabase.from("players").insert({                                                                                                        
game_id,                                                                                                                                     
name: "Bot",
color: PLAYER_COLORS[1],                                                                                                                     
position: 0,                                                                                                                                 
coins: 10000,
horses: [],                                                                                                                                  
turn_order: 1,                                        
is_bot: true,
discord_id: null,
discord_avatar_url: null,                                                                                                                    
});
}

Bot nechodí do lobby přes join — vytvoří se přímo při zakládání hry. UI: jednoduchý checkbox „Přidat bota (2 hráči)" v create formuláři.
   
---                                                                                                                                              
Exekutor bot tahu — kde běží

Klíčové rozhodnutí: kdo spouští bot?

Zvolená strategie: game owner's client jako executor přes server action.

Owner's browser → detekuje bot turn (Realtime) → volá server action                                                                              
Server action    → čte fresh state z DB → bot decision → píše do DB                                                                              
Realtime         → ostatní klienti vidí tah bota

Proč ne edge function / webhook: zbytečná infrastruktura pro MVP.                                                                                
Proč ne čistě klientský rollDice: rollDice() kontroluje currentPlayer.id === myPlayerId — bot ID ≠ owner ID, vrátil by se hned.                  
Proč server action: pattern již existuje (app/game/actions.ts), server má přístup k fresh DB stavu, zabrání double-execute pomocí guard.
                                                                                                                                                   
---                                                                                                                                              
Navržená architektura — konkrétní soubory

lib/bot/
botDecision.ts       (~80 ř.) — pure funkce, žádný React, žádný Supabase                                                                       
app/game/                                                                                                                                        
bot-actions.ts       (~170 ř.) — server action, volá Supabase přímo

lib/bot/botDecision.ts — pure, testovatelné

export interface BotContext {                                                                                                                    
player: Player;                                                                                                                                
field: Field | null;
gameState: GameState;                                                                                                                          
allPlayers: Player[];                                   
}

/** Vrátí "roll" když bot nemá nic pending, "buy"/"skip" pro horse_pending */                                                                    
export function decideBotRoll(_ctx: BotContext): "roll" {
return "roll"; // bot vždy hodí — žádné blokování                                                                                              
}

export function decideBotHorsePurchase(ctx: BotContext, racer: Horse): "buy" | "skip" {                                                          
const { player } = ctx;                                 
const horseCount = player.horses.length;                                                                                                       
const reserve = Math.floor(player.coins * 0.25); // drží 25% rezervu
const canAfford = player.coins - racer.price >= reserve;                                                                                       
const wantsMore = horseCount < 2;                                                                                                              
const randomSkip = Math.random() < 0.15; // 15% anti-robot náhodný přeskok

    if (horseCount === 0 && canAfford) return "buy"; // musí mít alespoň jednoho                                                                   
    if (wantsMore && canAfford && !randomSkip) return "buy";                                                                                       
    return "skip";                                                                                                                                 
}

export function decideBotPreferredRacer(horses: Horse[]): string | null {                                                                        
// Preferuj nejrychlejšího                              
if (horses.length === 0) return null;                                                                                                          
return racerOwnershipKey([...horses].sort((a, b) => b.speed - a.speed)[0]);
}

app/game/bot-actions.ts — server action (~170 řádků)

"use server";
// Imports: supabase admin, engine helpers, botDecision

export async function executeBotTurnAction(gameId: string): Promise<void> {                                                                      
// 1. Načti fresh state (guard: stale call check)                                                                                              
const { state, players, fields } = await fetchGameState(gameId);                                                                               
const botPlayer = players[state.current_player_index];                                                                                         
if (!botPlayer?.is_bot) return; // guard: už není bot na tahu

    // 2. Guard: pending rozhodnutí (horse/card) — řeší jiná action                                                                                
    if (state.horse_pending || state.card_pending || state.offer_pending) return;                                                                  
                                                                                                                                                   
    // 3. Bot hází kostkou                                                                                                                         
    const roll = Math.floor(Math.random() * 6) + 1;                                                                                                
    const newPosition = (botPlayer.position + roll) % fields.length;                                                                               
    const landingField = fields[newPosition];                                                                                                      
   
    // 4. Aplikuj pole efekt + finishTurn                                                                                                          
    await applyBotFieldEffect({ gameId, botPlayer, roll, newPosition, landingField, state, players });
}

export async function executeBotHorseDecisionAction(gameId: string): Promise<void> {                                                             
// Načti state, ověř horse_pending + bot, spusť decideBotHorsePurchase
}

Tato action duplikuje nutné minimum game logiky (position update, field effect, finishTurn equivalent). Neimportuje žádné klientské komponenty.  
Nezávisí na GameBoard.
                                                                                                                                                   
---                                                       
GameBoard.tsx — odhad přírůstku

Jediné místo: v existujícím Realtime handler game_state UPDATE (kolem line 710-726).

// Přidat za existující horse_pending block:              
const botCurrentPlayer = freshPlayers[freshState.current_player_index];                                                                          
const iAmGameOwner = freshPlayers[0]?.id === myPlayerId;

if (botCurrentPlayer?.is_bot && iAmGameOwner && !botTurnScheduledRef.current) {                                                                  
botTurnScheduledRef.current = true;                     
const delay = 800 + Math.random() * 1200;

    if (freshState.horse_pending) {                                                                                                                
      setTimeout(async () => {                              
        await executeBotHorseDecisionAction(gameId!);                                                                                              
        botTurnScheduledRef.current = false;
      }, delay);                                                                                                                                   
    } else if (!freshState.card_pending && !freshState.offer_pending) {
      setTimeout(async () => {                                                                                                                     
        await executeBotTurnAction(gameId!);
        botTurnScheduledRef.current = false;                                                                                                       
      }, delay);                                            
    }
}

Plus 1 nový ref: const botTurnScheduledRef = React.useRef(false); (+1 řádek).

Celkem do GameBoard.tsx: ~20 řádků. Žádné nové useState, žádné nové if větve v renderování.
                                                            
---                                                                                                                                              
UI — označení bota

V PlayerList.tsx (ne GameBoard!) — bot player dostane badge:

{player.is_bot && (
<span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 rounded px-1">                                     
BOT                                                                                                                                          
</span>                                                                                                                                        
)}

Avatar: iniciála "B" v neutrální šedé barvě — žádný Discord avatar.
   
---                                                                                                                                              
Minihry — napojení na PvBot

┌─────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│             Situace             │                                 Řešení                                 │                                     
├─────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤                                     
│ Stable Duel — bot je challenger │ existující pvbot_awareness mode, žádná změna                           │
├─────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤                                     
│ Stable Duel — bot je defender   │ server action nastaví defenderReady = true ihned                       │                                     
├─────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤                                     
│ Race minihra                    │ bot player skóruje normálně — race flow funguje bez klientského vstupu │                                     
├─────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤                                     
│ Legendary race                  │ stejné jako race                                                       │
└─────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
                                                            
---                                                                                                                                              
Do budoucna — veřejná bot lobby

Přidat do games tabulky has_bot: boolean. Na landing page nová sekce „Hrát hned s botem" — joinne existující waiting game s botem. Žádná změna
herní logiky.
                                                            
---                                                                                                                                              
Rizika

┌─────────────────────────────────────────┬───────────────┬───────────────────────────────────────────────────────────────────────────────────┐
│                 Riziko                 │  Závažnost   │                                      Řešení                                       │    
├────────────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────────────────────────┤  
│ Owner odejde — bot nehraje             │ střední      │ v dalším kroku: ostatní klienti jako fallback executor (timer check)              │  
├────────────────────────────────────────┼──────────────┼───────────────────────────────────────────────────────────────────────────────────┤  
│ Realtime fires 2× — double bot tah               │ střední        │ botTurnScheduledRef guard + server-side guard v action (re-fetch      │    
│                                                  │                │ check)                                                                │    
├──────────────────────────────────────────────────┼────────────────┼───────────────────────────────────────────────────────────────────────┤    
│ Bot card_pending — neexistující handler          │ nízká pro MVP  │ card auto-apply skip: bot kartu přeskočí (finishTurn bez efektu),     │    
│                                                  │                │ todo pro fázi 2                                                       │  
├──────────────────────────────────────────────────┼────────────────┼───────────────────────────────────────────────────────────────────────┤    
│ give_racer karta pro bota                        │ nízká          │ bot dostane racera automaticky — žádné UI pending, funguje bez změny  │
├──────────────────────────────────────────────────┼────────────────┼───────────────────────────────────────────────────────────────────────┤    
│ Bot v Stable Duel jako online defender           │ střední        │ server action detekuje offer_pending bot defender → okamžitě nastaví  │
│                                                  │                │ defenderReady                                                         │    
├──────────────────────────────────────────────────┼────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Duplicita game logiky (server action vs          │ vysoká         │ akceptovat pro MVP; fáze 3 = extrahovat shared                        │    
│ GameBoard rollDice)                              │ long-term      │ executePlayerTurn(params)                                             │
└──────────────────────────────────────────────────┴────────────────┴───────────────────────────────────────────────────────────────────────┘
                                                            
---
Postup implementace — krok za krokem

Krok 1 — Datový model                          (~30 min)
├── supabase/migrations/20260501_players_add_is_bot.sql                                                                                        
├── lib/database.types.ts — přidat is_bot
└── npx tsc --noEmit

Krok 2 — Bot decision logika                    (~45 min)                                                                                        
├── lib/bot/botDecision.ts (pure funkce)
└── npx tsc --noEmit

Krok 3 — Server action: bot tah                 (~90 min)
├── app/game/bot-actions.ts                                                                                                                    
│   ├── executeBotTurnAction (roll + position + field effect + finishTurn)                                                                     
│   └── executeBotHorseDecisionAction (buy/skip)                                                                                               
└── npx tsc --noEmit

Krok 4 — GameBoard.tsx trigger                  (~30 min)                                                                                        
├── botTurnScheduledRef
├── ~18 řádků v Realtime handler                                                                                                               
└── npx tsc --noEmit

Krok 5 — LandingPage: Přidat bota               (~30 min)                                                                                        
├── checkbox "Přidat bota"                              
├── bot player insert po createGame                                                                                                            
└── npx tsc --noEmit

Krok 6 — UI badge                               (~15 min)                                                                                        
├── PlayerList.tsx — is_bot badge                       
└── vizuální check

Krok 7 — E2E test lokálně                       (~30 min)                                                                                        
├── založ hru s botem, nech ho hrát 3 kola
├── ověř horse_pending, card_pending průchody                                                                                                  
└── ověř Stable Duel fallback na pvbot

Celkový odhad: 4–5 hodin implementace, ~500 nových řádků v nových souborech, +20 řádků v GameBoard.tsx.
