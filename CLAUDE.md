# Starter — instrukce pro Claude

Tento repozitář je šablona pro rychlé zakládání nových Next.js projektů.
Hynek řekne název a nápad → Claude udělá vše ostatní.

---

## Nastavení nového MacBooku (udělat jednou)

Bez těchto nástrojů Claude nemůže plně automatizovat zakládání projektů.
Projdi kroky v tomto pořadí.

### 1. Xcode Command Line Tools (git, make, atd.)
```bash
xcode-select --install
```

### 2. Homebrew (package manager)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 3. Node.js (přes nvm — správa verzí)
```bash
brew install nvm
# přidej do ~/.zshrc:
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
# pak:
source ~/.zshrc
nvm install --lts
nvm use --lts
```

### 4. GitHub CLI
```bash
brew install gh
gh auth login
# → zvolí: GitHub.com → HTTPS → Login with a browser
```

### 5. Vercel CLI
```bash
npm i -g vercel
vercel login
# → přihlásí přes browser
```

### 6. SSH klíč pro GitHub (pro git push)
```bash
ssh-keygen -t ed25519 -C "tvuj@email.cz"
# Enter třikrát (výchozí cesta, bez hesla)
cat ~/.ssh/id_ed25519.pub
# zkopíruj výstup a přidej na github.com/settings/keys
```

### 7. Git konfigurace
```bash
git config --global user.name "darbujan"
git config --global user.email "tvuj@email.cz"
```

### 8. Vercel — napoj GitHub účet
Na vercel.com → Settings → Git → Connect GitHub účet `czhyenacz-g`.
Zaškrtni "Auto-deploy on push" pro všechna repozitáře.

### Ověření že vše funguje
```bash
node --version      # v20+
git --version       # 2.x
gh auth status      # Logged in to github.com
vercel whoami       # tvoje jméno na Vercel
```

---

## Stack

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **Vercel Analytics** (`@vercel/analytics`)
- **GoatCounter** (volitelně, nastavit v `app/config/analytics.ts`)
- Deploy: **Vercel** (auto-deploy z GitHubu na push do `main`)

---

## Tokeny (API přístupy)

Uloženy v `~/PhpstormProjects/starter/.tokens` — soubor není commitován (.gitignore).

Obsahuje:
- `GITHUB_TOKEN` — pro vytváření GitHub repozitářů přes API
- `VERCEL_TOKEN` — pro vytváření a deploy Vercel projektů přes API

Před každou akcí načti tokeny:
```bash
source ~/PhpstormProjects/starter/.tokens
```

---

## Jak založit nový projekt

### 1. Zkopíruj starter

```bash
cp -r ~/PhpstormProjects/starter ~/PhpstormProjects/PROJEKT_NAZEV
cd ~/PhpstormProjects/PROJEKT_NAZEV
rm -rf .git node_modules .next
```

### 2. Nahraď placeholdery

V celém projektu vyhledej a nahraď:
- `PROJECT_NAME` → název projektu (např. "Kolik piv to je?")
- `PROJECT_DESCRIPTION` → jeden řádek co to dělá
- `PROJECT_DOMAIN` → doména (např. `kolikpiv.cz`) nebo zatím `TODO`

Soubory kde se placeholdery vyskytují:
- `app/layout.tsx` — metadata (title, description, OG)
- `app/page.tsx` — hlavní stránka
- `app/api/og/route.tsx` — OG image
- `package.json` — `"name"` pole

### 3. Inicializuj Git a pushnui na GitHub

```bash
git init
git add .
git commit -m "init"
# Vytvoř repo na github.com/czhyenacz-g (nebo přes gh CLI):
gh repo create czhyenacz-g/PROJEKT_NAZEV --public --source=. --push
```

Pokud `gh` není nainstalované:
```bash
brew install gh
gh auth login
```

### 4. Napoj Vercel

Buď automaticky (pokud je Vercel napojený na GitHub org) — stačí push.

Nebo manuálně:
```bash
npm i -g vercel
vercel login
vercel --prod
```

### 5. Nainstaluj závislosti a spusť lokálně

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Struktura projektu

```
app/
  layout.tsx          # Root layout, metadata, analytics
  page.tsx            # Hlavní stránka
  globals.css         # Tailwind direktivy
  config/
    analytics.ts      # GoatCounter kód
  api/
    og/
      route.tsx       # Dynamický OG image endpoint
```

---

## Konvence

- **Tmavý theme**: `bg-gray-900 text-white` na body (v layout.tsx)
- **Max šířka obsahu**: `max-w-md` nebo `max-w-lg` + `mx-auto`
- **Barvy**: amber pro akcenty (`text-amber-400`, `bg-amber-600`)
- **Jazyk**: česky, neformální tón
- **Komponenty**: pokud je stránka interaktivní, přidej `"use client"` komponentu do `app/components/`
- **Sdílení**: OG image přes `/api/og` s query params (`title`, `sub`, vlastní)

---

## Checklist pro nový projekt

- [ ] Nahrazeny všechny `PROJECT_*` placeholdery
- [ ] `package.json` má správné `"name"`
- [ ] `npm install` proběhl
- [ ] `npm run dev` funguje na localhost:3000
- [ ] Git repo vytvořeno a pushnuté
- [ ] Vercel nasadil — URL funguje
- [ ] OG image funguje: `https://DOMENA/api/og?title=Test`

---

## Vzorový projekt

Referenční implementace: `~/PhpstormProjects/kolikpiv.cz/kolikpiv/`

Obsahuje příklady:
- Kalkulačka s výsledkem a sdílením
- Dynamický OG image s parametry
- Share text s URL params
- GoatCounter + Vercel Analytics
- QR kód generování
- LocalStorage pro uložení nastavení

# CLAUDE.md

## Pravidla pro práci na tomto projektu

- Dělej pouze minimální nutné změny.
- Nic nerozbít.
- Zachovej existující funkcionalitu.
- Nedělej velký refactor bez explicitního zadání.
- Nesahej na nesouvisející části kódu.
- Neopravuj bokem další věci, které nesouvisí s úkolem.
- Preferuj malé, bezpečné a dobře reviewovatelné změny.
- Po změně vždy spusť relevantní validaci.

## Kvalita kódu

- Kód musí zůstat čitelný, udržitelný a rozšiřitelný.
- Změny musí být snadno pochopitelné pro dalšího programátora.
- Nevytvářej zbytečný technický dluh.
- Preferuj jednoduché řešení před zbytečně složitým.
- Mysli i na budoucí monetizaci aplikace a případný prodej projektu.

## Požadovaný výstup po každém úkolu

Na konci vždy napiš:

1. Jaké soubory jsi změnil
2. Co jsi změnil
3. Jak jsi změnu validoval
4. Výsledek validace
5. Případná rizika nebo co nešlo ověřit
