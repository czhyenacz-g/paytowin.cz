# PayToWin.cz — přehled funkčnosti

## Herní mechanika

### Deska a tahy
- 21 polí v oválu, 2–32 hráčů střídá tahy
- Hod šestistěnnou kostkou (SVG animace, randomizované trvání)
- Figurka se pohybuje pole po poli s animací a zvukovým efektem (Web Audio API)
- Zlatá stopa — zvýrazní políčka, přes která figurka prošla

### Typy polí
- 🏁 **START** — +200 coins dotace; daň roste každé kolo (kolo 1 = 0, kolo 2 = −50, kolo 3 = −100 … max −500 — "státní zadlužení")
- 🟢 **Zisk** — různé bonusy (+40 až +150 coins)
- 🔴 **Ztráta** — různé postihy (−50 až −120 coins)
- 🟣 **Hazard** — Loterie / Sázkovka / Ruleta (náhodná výhra nebo ztráta)
- 🟠 **Kůň** — 4 koně na prodej (Divoká růže, Modrý blesk, Zlatá hříva, Rychlý vítr), různé rychlosti a ceny

### Koně
- Při přistání na koňském poli nabídka koupě / přeskočení
- Každý hráč může vlastnit libovolný počet koní (ne stejného dvakrát)
- Vlastněná pole mají barevný rámeček + tečka barvy vlastníka
- Tooltip na hover: rychlost, cena, kdo vlastní / "Na prodej"

### Ekonomika
- Každý hráč začíná s 1 000 coins
- Bankrot při ≤ 0 coins → figurka zmizí z desky, tahy se přeskakují
- Hra pokračuje dokud nezůstane jediný aktivní hráč

---

## Herní režimy

### Online hra (`/`)
- Host vytvoří hru, sdílí odkaz nebo kód
- Hráči se připojují na různých zařízeních přes Supabase Realtime
- Každý hráč vidí jen své tlačítko "Hoď kostkou" ve svém tahu
- Výběr max. hráčů (2–32) při vytvoření
- Join uzavřen po skončení 1. kola nebo při plné hře

### Lokální hra / hot-seat (`/local/new`)
- Více hráčů u jednoho zařízení
- Host (Discord) zadá 2–8 jmen hráčů
- Všichni hrají na jednom browseru, střídají se fyzicky

---

## Multiplayer infrastruktura

- **Supabase Realtime** — WebSocket subscriptions na `players`, `game_state`, `games`
- Každý klient vidí změny ostatních okamžitě bez refreshe
- Při animaci pohybu figurky ochrana před Realtime přepsáním pozice (refs)
- `localStorage` jako identita hráče pro danou hru (`paytowin_player_${code}`)

---

## Uživatelské role

| Role | Popis |
|---|---|
| **Hráč** | Má localStorage klíč, může házet ve svém tahu |
| **Host** | Vytvořil hru, vidí tlačítko "Zrušit hru" |
| **Pozorovatel** | Přihlášen přes Discord, vidí hru ale nemůže hrát |
| **Nepřihlášený** | Vyzván k Discord loginu pro sledování |

---

## Správa her

### Pro hráče
- Vytvoření hry se sdílecím odkazem
- Připojení přes kód nebo URL parametr `?join=KOD`
- Host může hru zrušit → ostatní klienti dostanou obrazovku "Hra zrušena" přes Realtime

### Admin panel (`/admin`, přístup jen Discord host)
- Seznam všech her, smazání hry
- Detail hráčů každé hry
- **Impersonace** — "Hrát jako →" nastaví localStorage a otevře hru jako daný hráč
- Editace katalogu koní (emoji, název, rychlost, cena)

### Seznam aktivních her (`/hry`)
- Vyžaduje Discord login
- Realtime aktualizace
- Zobrazuje online hry (bez local a cancelled)

---

## UI / UX

- **Theme systém** — 2 témata: Klasika (světlá) a Noční závody (tmavá)
- Výběr tématu při vytvoření hry, uloženo v DB
- Modální okno "Procházet všechna témata" (připraveno pro budoucí témata s náhledem a cenou)
- Hover tooltips na koňských polích (rychlost, cena, vlastník) — instant CSS, bez JS
- Zvuky zapnutelné/vypnutelné (ukládá se do localStorage)
- Pozorovatel badge, lokální hra badge, badge "Na tahu"
- Responsivní layout (board + pravý panel)

---

## Ostatní stránky

- `/pravidla` — pravidla hry včetně narativu o rostoucích daních
- `/o-nas` — popis projektu
- `/hry` — seznam aktivních her
- `/local/new` — vytvoření lokální hry

---

## Tech stack

Next.js 15 · TypeScript · Tailwind CSS · Supabase (Postgres + Realtime) · Discord OAuth (implicit flow) · Vercel
