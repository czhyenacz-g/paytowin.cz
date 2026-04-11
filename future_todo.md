# Future TODO — nápady a plánované funkce

## 🏆 Mechanika výhry

### 🟢 Varianta 1: Klasika (nejjednodušší, pro PoC ideální)
- Poslední hráč co není bankrotář = vítěz
- Hra okamžitě končí
- Zobrazit obrazovku s vítězem

### 🟡 Varianta 2: Vítěz + bonus (lepší)
- Poslední hráč vyhrává
- Získává celý BANK (součet všech ztrát ostatních hráčů?)
- Uspokojivější konec — vítěz odchází s konkrétní sumou

### 🔴 Varianta 3: Finální závod — FINAL RACE (nejzábavnější 🔥)
- Když zbývají 2 hráči → automaticky se spustí „FINAL RACE"
- Hráči s koňmi závodí na dostihové dráze
- Vítěz bere vše (coins soupeře, případně BANK)
- Dramatický konec — přirozeně navazuje na mechaniku koní

---

## 🐎 Závody (Dostihová dráha)
- Hráči s koňmi se utkají na dostihové dráze
- Rychlost koně ovlivňuje výsledek závodu
- Propojení s Varianta 3 výše

## 🏠 Stáje
- Hráč si může koupit pole (stáj)
- Ostatní hráči platí nájem při přistání

## 💬 Discord integrace
- Chat widget / voice místnost přímo v herním UI
- Využití Discord User ID (již ukládáme do localStorage)

## 🔔 Notifikace
- Upozornění při tahu (push / zvuk / badge)

## 📱 Mobilní UI
- Herní deska není responsivní na malých obrazovkách

## 🔒 Admin
- Přihlášení pro /admin je zatím jen Discord ID check — bez role systému

## 🎵 Zvuky
- Více zvukových efektů: hod kostkou, bankrot, nákup koně, výhra
- Možnost vybrat zvukový balíček
