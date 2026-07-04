# Audio systém — struktura a použití

## Stav

Toto je připravená souborová a kódová struktura pro budoucí hudbu a zvuky.
**Žádné reálné audio soubory nejsou součástí repozitáře.**
Složky jsou udržovány pomocí `.gitkeep` souborů.

---

## Kam vložit hudební soubory

| Kontext       | Cesta                                               |
|---------------|-----------------------------------------------------|
| `menu`        | `public/audio/music/menu/menu-theme.mp3`            |
| `race_horses` | `public/audio/music/maps/horses/horse-race-theme.mp3` |
| `race_cars`   | `public/audio/music/maps/cars/city-car-race-theme.mp3` |
| `race_default`| `public/audio/music/maps/default/default-race-theme.mp3` |

## Kam vložit SFX soubory

| Event           | Cesta                              |
|-----------------|------------------------------------|
| `ui_click`      | `public/audio/sfx/ui/click.mp3`    |
| `ui_confirm`    | `public/audio/sfx/ui/confirm.mp3`  |
| `ui_back`       | `public/audio/sfx/ui/back.mp3`     |
| `race_start`    | `public/audio/sfx/race/start.mp3`  |
| `race_finish`   | `public/audio/sfx/race/finish.mp3` |
| `race_countdown`| `public/audio/sfx/race/countdown.mp3` |
| `reward_open`   | `public/audio/sfx/rewards/open.mp3` |
| `error_soft`    | `public/audio/sfx/ui/error-soft.mp3` |

---

## Doporučený formát

- **MP3** — primární formát, dobrá kompatibilita ve všech prohlížečích
- **OGG/WebM** — volitelná budoucí optimalizace pro menší velikost

---

## Použití audio manageru

```ts
import { playMusic, stopMusic, playSfx, unlockAudio } from "@/lib/audio/audio-manager";

// Po první uživatelské interakci (klik, tap):
unlockAudio();

// Hudba:
playMusic("menu");        // spustí menu hudbu jako loop
playMusic("race_horses"); // přepne na koňský track
stopMusic();              // zastaví vše

// SFX:
playSfx("ui_click");
playSfx("race_start");

// Nastavení:
import { setMusicEnabled, setMasterVolume } from "@/lib/audio/audio-manager";
setMusicEnabled(false);
setMasterVolume(0.5);
```

---

## Vývojářský testovací panel

`/sound-dev` — stránka pro ruční testování všech tracků a SFX.
V produkci přesměruje na `/`.

---

## Licence

Všechny hudební soubory vložené do `public/audio/` musí mít vyřešenou licenci
(CC0, royalty-free, vlastní tvorba nebo řádně zakoupená licence).
**Nikdy nevkládej soubory stažené bez licence.**
