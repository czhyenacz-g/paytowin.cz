# Závodníci — přehled

> Zdroj: Supabase DB, tabulka `racers`. Aktualizováno 2026-05-03.

## Důležité zdroje dat

- **Závodiště Pardubice — historické výsledky:** https://zavodistepardubice.cz/1965-2/
  Ověřené výsledky Velké pardubické, jména a umístění skutečných koní. Primární referenční zdroj pro classic legend horses.

- **Wikipedia — Dostihy a sázky:** https://cs.wikipedia.org/wiki/Dostihy_a_s%C3%A1zky
  Popis originální deskové hry, pravidla, terminologie. Základ pro herní mechaniky a tematický kontext.

---

## 🐪 Camel

| ID | Jméno | Speed | Cena | Stamina | Flavor text |
|---|---|:---:|---:|:---:|---|
| `zlaty_blesk` | Zlatý blesk | 8 | 250 | 90 | Blesk! |

---

## 🏎️ Car

| ID | Jméno | Speed | Cena | Stamina | Flavor text |
|---|---|:---:|---:|:---:|---|
| `r8` | Legendarion ✦ | 10 | 99 999 | 100 | Když se Legendarion postaví na start, ostatní závodí o druhé místo. |
| `car_day_r5` | Tvoja mama | 8 | 1 500 | 100 | Za tu cenu? Nečekals to. Ona to věděla. |
| `car_night_r5` | Tvuj tata | 8 | 1 500 | 100 | Rychlý, levný a lehce nepochopitelný. Jako táta. |
| `rychly_demon` | Rychlý démon | 5 | 1 500 | 100 | Démon? Spíš čertík. Ale dojet do cíle umí. |
| `modry_blesk` | Blue thunder | 3 | 1 500 | 95 | Hřmí víc než jezdí. Ale nikdo nevěřil ani Železníkovi. |
| `modra_strela` | Modrá střela | 3 | 2 500 | 100 | Střela v názvu, tramvaj v srdci. Hrdá na to. |
| `stary_mustang` | Starý Mustang | 2 | 800 | 100 | Přijede poslední — ale přijede. A bez proseb o servis. |
| `sombra_roja` | Sombra Roja | 2 | 800 | 100 | Rudý stín přijíždí pomalu — ale na závodišti ho přehlédnout nejde. |

---

## 🐴 Horse

| ID | Jméno | Speed | Cena | Stamina | Flavor text |
|---|---|:---:|---:|:---:|---|
| `zeleznik` | Železník ✦ | 10 | 99 999 | 10 | Železník — legendární kůň, který nezná strach, únavu ani druhé místo. Jeho jediný cíl je jasný: vyhrát. |
| `rychly_vitr` | Razor Wind | 9 | 4 000 | 80 | Vítr nemá brzy — buď fouká, nebo ne. |
| `horse_night_buran` | Burano | 7 | 5 000 | 95 | Masivní černý kůň, který vítězí silou a výdrží spíš než rychlým startem. |
| `horse_classic_pablo` | Pablo | 7 | 4 500 | 78 | Závodí s elegancí. Dech si hlídá sám. |
| `zlata_hriva` | Goldie | 6 | 3 000 | 90 | Zlatá srst, stříbrné nervy. Spolehlivá jako zlatý standard. |
| `caballo_real` | Caballo Real | 5 | 3 500 | 100 | Kůň s královskou výdrží. |
| `r6` | Pepík | 4 | 2 500 | 100 | Pepó! Pepane! Pepíku!! |
| `el_relampago` | Křemešník | 4 | 2 000 | 90 | Veterán závodního okruhu, co ještě nepůjde do salámu. |
| `viento_dorado` | Hogo fogo | 3 | 1 500 | 100 | Umí zabrat, ale i shodit jezdce! |
| `divoka_ruze` | Mariane DR | 2 | 1 200 | 100 | Nějaká kůň musí být nejlevnější. |

---

✦ = legendární (jedinečný, při ztrátě staminy se zobrazí speciální hláška)
