You are a senior frontend developer (Next.js + Tailwind + Vercel) and UI/UX designer.

Build a simple website for a Czech cleaning and service company based on the following real flyer content.

---

🎯 GOAL

Create a minimal, fast, visually unique website with a hand-drawn / sketch style inspired by architectural drawings.

The site should feel:
- human
- slightly playful
- Czech/local
- not corporate

---

🎨 DESIGN STYLE

Inspired by the flyer:

- hand-drawn house illustration (black sketch lines, simple shading)
- red accent block (#d32f2f or similar)
- light background (white / cream)
- minimal layout
- subtle "sparkle" effects (✨ stars for cleanliness)
- simple human figures (cleaner, worker) in sketch style

IMPORTANT:
- Do NOT copy any copyrighted images
- Create original SVG illustrations in similar style

---

📐 STRUCTURE

1) HERO SECTION

- centered layout
- include a flipbook-style animation:
    - house being cleaned OR
    - windows being cleaned
- simple animation (frame-based or CSS/SVG)

Text:

Headline:
"Úklid na klik"

Subheadline:
"Profesionální úklid a servis pro váš domov"

CTA:
- "Zavolat"
- "Napsat"

---

2) SERVICES SECTION

Use content from flyer:

LEFT COLUMN (ÚKLIDOVÉ SLUŽBY):

- Generální a pravidelné úklidy
- Tepování koberců a sedaček
- Mytí oken a žaluzií
- Stavební úklidy
- Úklid parním profesionálním přístrojem (až 160°C)
- Organizace vašich skříní a úložných prostor (šatní skříně, lednice, botníky apod.)

RIGHT COLUMN (OKNA A DVEŘE):

- Prodej a montáž plastových oken
- Hliníková okna
- Eurookna
- Dřevěná okna
- Dřevohliníková okna
- Nově: realizace fasád, rekonstrukce bytů, výstavba rodinných domů
- Dodáváme po celé České republice

Display:
- two columns on desktop
- stacked on mobile

---

3) VISUAL ELEMENT

Add central illustration:

- house (sketch style)
- with:
    - window highlight
    - sparkle effects
    - cleaner character (vacuum)
    - worker character (installing window)

---

4) CONTACT SECTION

Use real data from flyer:

Company:
TOPTERKA s.r.o.

Website:
www.uklidnaklik.com

Phone:
+420 734 148 215

Instagram:
@uklidnaklik_hk

Second company (optional block):

M.A.T. Okna a dveře s.r.o.
www.mat-okna.cz
+420 606 662 081
@mat_okna

---

5) CONTENT SOURCE (IMPORTANT)

Structure data like a simple spreadsheet:

Create a local JSON file:

/data/content.json

Include:
- company info
- services
- contact

Add comment:
"// This can later be replaced by Google Sheets API"

---

6) PERFORMANCE & SECURITY

- no API keys in frontend
- no heavy libraries
- fast loading
- optimized images (or SVG)

---

7) TECH STACK

- Next.js (App Router)
- TailwindCSS
- deploy-ready for Vercel

---

8) CODE QUALITY

- clean components:
    - Hero
    - Services
    - Illustration
    - Contact

- reusable
- readable

---

9) BONUS

- add subtle hover animation on buttons
- add small sparkle animation (CSS)

---

📦 OUTPUT

Provide:

1. Full project structure
2. All components
3. content.json
4. instructions:
    - npm install
    - npm run dev
    - deploy to Vercel

---

IMPORTANT:

Do NOT overcomplicate.

Keep it:
- simple
- fast
- visually unique
- easy to edit