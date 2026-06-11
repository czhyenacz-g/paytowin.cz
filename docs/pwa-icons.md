# PWA ikonky — PayToWin.cz

## Soubory v `public/`

**Stav:** všechny ikonky jsou doplněny (placeholder, zdroj: `favicon.svg` — „P" v amberu na tmavém pozadí).
Lze nahradit finálním logem — stačí přepsat PNG soubory stejných rozměrů.

## Specifikace souborů

| Soubor | Rozměr | Účel |
|---|---|---|
| `icon-192.png` | 192×192 px | Android home screen, PWA manifest |
| `icon-512.png` | 512×512 px | Android splash screen, PWA manifest |
| `icon-maskable-512.png` | 512×512 px | Android adaptivní ikona (obsah musí být v centrálním kruhu ~80 % plochy) |
| `apple-touch-icon.png` | 180×180 px | iOS home screen (Safari "Přidat na plochu") |
| `favicon.ico` | 32×32 nebo 16×16 px | Prohlížeč tab (volitelně, v projektu je `favicon.svg`) |

### Poznámky k maskable ikoně
- Bezpečná zóna: obsah (logo) musí být v kruhu o průměru ~80 % šířky obrázku
- `icon-maskable-512.png` má logo na ~60 % plochy (padding ~20 % na každé straně) — bezpečné pro libovolný Android ořez
- Pozadí může přesahovat okraje — Android ho ořízne do tvaru dle systému (kruh, čtverec se zaoblením apod.)
- Pozadí: `#0f172a` (tmavá, odpovídá `favicon.svg`)

---

## Jak přidat PayToWin na plochu

### iOS (Safari)
1. Otevři **paytowin.cz** v Safari
2. Klepni na tlačítko **Sdílet** (čtverec se šipkou nahoru) ve spodní liště
3. Vyber **„Přidat na plochu"**
4. Potvrď název a klepni **Přidat**

### Android (Chrome)
1. Otevři **paytowin.cz** v Chrome
2. Chrome sám nabídne banner **„Přidat na plochu"** — klepni na něj
3. Nebo: menu (tři tečky vpravo nahoře) → **„Přidat na plochu"** / **„Nainstalovat aplikaci"**
4. Potvrď

---

## Technická implementace

- `app/manifest.ts` — Next.js App Router manifest route (`/manifest.webmanifest`)
- `app/layout.tsx` — `apple-touch-icon`, `appleWebApp` metadata, `themeColor`
- Žádný service worker — offline režim není implementován
