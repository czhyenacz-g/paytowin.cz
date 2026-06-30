/**
 * scripts/import-classic-legend-images.mjs
 *
 * Převede historické classic legend koně z public/legendary-clasic/ do WebP
 * a vygeneruje manifest data/racer-imports/horses-classic-legend.generated.json.
 *
 * Výstup:
 *   public/themes/_shared/racers/imported/legendary-classic/*.webp
 *   data/racer-imports/horses-classic-legend.generated.json
 */

import { createRequire } from "module";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SRC_DIR = path.join(ROOT, "public", "legendary-clasic");
const TARGET_DIR = path.join(ROOT, "public", "themes", "_shared", "racers", "imported", "legendary-classic");
const MANIFEST_PATH = path.join(ROOT, "data", "racer-imports", "horses-classic-legend.generated.json");
const PUBLIC_BASE = "/themes/_shared/racers/imported/legendary-classic";

const WEBP_OPTIONS = {
  width: 512,
  height: 512,
  fit: "contain",
  background: { r: 0, g: 0, b: 0, alpha: 0 },
  quality: 85,
};

// filename (without extension, case-insensitive) → slug mapping + embedded metadata
const HORSE_DATA = {
  "fantome": {
    slug: "fantome", displayName: "Fantôme",
    confirmedType: "horse", confirmedColor: "hnědák", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 8, price: 1500,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "První stopa v historii.",
  },
  "gavora": {
    slug: "gavora", displayName: "Gavora",
    confirmedType: "horse", confirmedColor: "tmavá hnědka", confirmedRole: "classic_legend",
    speed: 6, maxStamina: 10, price: 1800,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Tmavá klisna s dlouhou pamětí.",
  },
  "lady_anne": {
    slug: "lady-anne", displayName: "Lady Anne",
    confirmedType: "horse", confirmedColor: "ryzka", confirmedRole: "classic_legend",
    speed: 9, maxStamina: 10, price: 9000,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Dáma, která se neptá na svolení.",
  },
  "pasek": {
    slug: "pasek", displayName: "Pasek",
    confirmedType: "horse", confirmedColor: "hnědák", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 8, price: 2200,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Jméno podle stopy přes čelo.",
  },
  "koran": {
    slug: "koran", displayName: "Koran",
    confirmedType: "horse", confirmedColor: "hnědák", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 11, price: 6500,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Síla bez okázalosti.",
  },
  "neklan": {
    slug: "neklan", displayName: "Neklan",
    confirmedType: "horse", confirmedColor: "ryzák", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 8, price: 2600,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Staré jméno, tvrdý krok.",
  },
  "portland": {
    slug: "portland", displayName: "Portland",
    confirmedType: "horse", confirmedColor: "hnědák", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 8, price: 2000,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Jméno opravené v cílové rovině.",
  },
  "japan": {
    slug: "japan", displayName: "Japan",
    confirmedType: "horse", confirmedColor: "hnědák", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 7, price: 2400,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Tiché jméno s těžkou stopou.",
  },
  "kostrava": {
    slug: "kostrava", displayName: "Kostrava",
    confirmedType: "horse", confirmedColor: "hnědka", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 9, price: 3000,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Klisna, která drží trať.",
  },
  "lukava": {
    slug: "lukava", displayName: "Lukava",
    confirmedType: "horse", confirmedColor: "bělka", confirmedRole: "classic_legend",
    speed: 6, maxStamina: 11, price: 4200,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Světlá stopa na dlouhé trati.",
  },
  "melak": {
    slug: "melak", displayName: "Melák",
    confirmedType: "horse", confirmedColor: "tmavý hnědák", confirmedRole: "classic_legend",
    speed: 6, maxStamina: 8, price: 1800,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Nenápadný tmavý kus.",
  },
  "grifel": {
    slug: "grifel", displayName: "Grifel",
    confirmedType: "horse", confirmedColor: "ryzák", confirmedRole: "classic_legend",
    speed: 8, maxStamina: 11, price: 8500,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Dvakrát vítěz, jednou legenda.",
  },
  "mohyla": {
    slug: "mohyla", displayName: "Mohyla",
    confirmedType: "horse", confirmedColor: "hnědka", confirmedRole: "classic_legend",
    speed: 6, maxStamina: 10, price: 3600,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Stojí pevně, i když ostatní padají.",
  },
  "metal": {
    slug: "metal", displayName: "Metál",
    confirmedType: "horse", confirmedColor: "tmavý hnědák", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 10, price: 5000,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Lesk, který něco váží.",
  },
  "tara": {
    slug: "tara", displayName: "Tara",
    confirmedType: "horse", confirmedColor: "ryzka", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 8, price: 2800,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Krátké jméno, lehký krok.",
  },
  "furioso": {
    slug: "furioso", displayName: "Furioso",
    confirmedType: "horse", confirmedColor: "ryzák", confirmedRole: "classic_legend",
    speed: 8, maxStamina: 10, price: 8000,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Temperament se starým rodokmenem.",
  },
  "furioso_xiv": {
    slug: "furioso-xiv", displayName: "Furioso XIV",
    confirmedType: "horse", confirmedColor: "ryzák", confirmedRole: "classic_legend",
    speed: 8, maxStamina: 10, price: 8000,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Temperament se starým rodokmenem.",
  },
  "genius": {
    slug: "genius", displayName: "Genius",
    confirmedType: "horse", confirmedColor: "tmavý hnědák", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 9, price: 3200,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Nepospíchá. Počítá.",
  },
  "shagga": {
    slug: "shagga", displayName: "Shagga",
    confirmedType: "horse", confirmedColor: "tmavý hnědák", confirmedRole: "classic_legend",
    speed: 6, maxStamina: 9, price: 2200,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Nepůsobí uhlazeně. O to víc drží.",
  },
  "dahoman": {
    slug: "dahoman", displayName: "Dahoman",
    confirmedType: "horse", confirmedColor: "hnědák", confirmedRole: "classic_legend",
    speed: 6, maxStamina: 9, price: 2600,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Starý tón ve jméně i kroku.",
  },
  "gira": {
    slug: "gira", displayName: "Gira",
    confirmedType: "horse", confirmedColor: "ryzka", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 8, price: 2400,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Krátká karta s lehkou hlavou.",
  },
  "narcius": {
    slug: "narcius", displayName: "Narcius",
    confirmedType: "horse", confirmedColor: "ryzák s lysinou", confirmedRole: "classic_legend",
    speed: 7, maxStamina: 8, price: 3000,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Jméno, které chce být vidět.",
  },
  "napoli": {
    slug: "napoli", displayName: "Napoli",
    confirmedType: "horse", confirmedColor: "ryzka", confirmedRole: "classic_legend",
    speed: 9, maxStamina: 11, price: 10000,
    rarity: "legendary_classic", poolType: "classic_legend", spawnSource: "historical_stable_card",
    flavorText: "Jméno s rodokmenem a cenou, která se neomlouvá.",
  },
};

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("❌ Nelze načíst sharp. Ujisti se, že je nainstalovaný: npm install sharp");
    process.exit(1);
  }

  if (!existsSync(SRC_DIR)) {
    console.error(`❌ Zdrojová složka neexistuje: public/legendary-clasic`);
    process.exit(1);
  }

  await fs.mkdir(TARGET_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const entries = await fs.readdir(SRC_DIR);
  const imageFiles = entries
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort();

  console.log(`\n📂 legendary-clasic (${imageFiles.length} obrázků)`);

  const manifest = [];
  let converted = 0;
  let skipped = 0;

  for (const file of imageFiles) {
    const nameWithoutExt = path.basename(file, path.extname(file));
    const key = nameWithoutExt.toLowerCase();
    const data = HORSE_DATA[key];

    if (!data) {
      console.warn(`  ⚠️  Žádná YAML data pro: ${file} (klíč: ${key}) — přeskakuji`);
      skipped++;
      continue;
    }

    const targetFilename = `classic-horse-${data.slug}.webp`;
    const targetPath = path.join(TARGET_DIR, targetFilename);
    const publicPath = `${PUBLIC_BASE}/${targetFilename}`;
    const id = `classic-horse-${data.slug}`;

    try {
      await sharp(path.join(SRC_DIR, file))
        .resize(WEBP_OPTIONS.width, WEBP_OPTIONS.height, {
          fit: WEBP_OPTIONS.fit,
          background: WEBP_OPTIONS.background,
        })
        .webp({ quality: WEBP_OPTIONS.quality })
        .toFile(targetPath);

      console.log(`  ✓ ${file} → ${targetFilename}`);
      converted++;
    } catch (err) {
      console.error(`  ✗ ${file} — konverze selhala: ${err.message}`);
      skipped++;
      continue;
    }

    manifest.push({
      id,
      sourceFolder: "legendary-clasic",
      sourceFile: file,
      targetPath: publicPath,
      suggestedCategory: "perma",
      displayName: data.displayName,
      slug: data.slug,
      confirmedType: data.confirmedType,
      confirmedColor: data.confirmedColor,
      confirmedRole: data.confirmedRole,
      speed: data.speed,
      maxStamina: data.maxStamina,
      price: data.price,
      rarity: data.rarity,
      poolType: data.poolType,
      spawnSource: data.spawnSource,
      flavorText: data.flavorText,
      story: null,
      notes: null,
    });
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`
────────────────────────────────────
✅ Import dokončen

  Nalezeno obrázků:   ${imageFiles.length}
  Převedeno WebP:     ${converted}
  Přeskočeno/chyba:   ${skipped}

  Výstupní složka:    public/themes/_shared/racers/imported/legendary-classic/
  Manifest:           data/racer-imports/horses-classic-legend.generated.json
────────────────────────────────────`);
}

main().catch((err) => {
  console.error("❌ Script selhal:", err);
  process.exit(1);
});
