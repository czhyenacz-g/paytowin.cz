/**
 * scripts/import-racer-images.mjs
 *
 * Převede lokální pracovní PNG obrázky koní do WebP a vygeneruje manifest.
 *
 * Zdroje:
 *   public/zavodni_kone_rozrezane   → suggestedCategory: "race"
 *   public/pracovni_kone_rozrezane  → suggestedCategory: "work"
 *   public/perma_kone_rozrezane     → suggestedCategory: "perma"
 *
 * Výstup:
 *   public/themes/_shared/racers/imported/horses/*.webp
 *   data/racer-imports/horses.generated.json
 *
 * Parametry konverze: WebP 512×512, fit: contain, quality 85, průhlednost zachována.
 * (konzistentní s saveBuiltinRacerImageAction — liší se jen v fit: contain místo cover,
 *  protože raceři jsou ořezané postavy s průhledností)
 *
 * Nepíše do DB. Nezakládá žádné záznamy.
 */

import { createRequire } from "module";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Konfigurace zdrojů ───────────────────────────────────────────────────────

const SOURCES = [
  {
    folder: "zavodni_kone_rozrezane",
    prefix: "race",
    suggestedCategory: "race",
  },
  {
    folder: "pracovni_kone_rozrezane",
    prefix: "work",
    suggestedCategory: "work",
  },
  {
    folder: "perma_kone_rozrezane",
    prefix: "perma",
    suggestedCategory: "perma",
  },
];

const TARGET_DIR = path.join(ROOT, "public", "themes", "_shared", "racers", "imported", "horses");
const MANIFEST_PATH = path.join(ROOT, "data", "racer-imports", "horses.generated.json");
const PUBLIC_BASE = "/themes/_shared/racers/imported/horses";

const WEBP_OPTIONS = {
  width: 512,
  height: 512,
  fit: "contain",      // contain zachová průhlednost / celou postavu bez ořezu
  background: { r: 0, g: 0, b: 0, alpha: 0 }, // průhledné pozadí
  quality: 85,
};

// ─── Pomocné funkce ───────────────────────────────────────────────────────────

function toSafeSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractNumber(filename) {
  const match = filename.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function listImageFiles(dir) {
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
      .sort((a, b) => extractNumber(a) - extractNumber(b));
  } catch {
    return null;
  }
}

// ─── Hlavní logika ────────────────────────────────────────────────────────────

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("❌ Nelze načíst sharp. Ujisti se, že je nainstalovaný: npm install sharp");
    process.exit(1);
  }

  await fs.mkdir(TARGET_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const manifest = [];
  let totalFound = 0;
  let totalConverted = 0;
  let totalSkipped = 0;

  for (const source of SOURCES) {
    const srcDir = path.join(ROOT, "public", source.folder);

    if (!existsSync(srcDir)) {
      console.warn(`⚠️  Složka neexistuje, přeskakuji: public/${source.folder}`);
      continue;
    }

    const files = await listImageFiles(srcDir);
    if (files === null) {
      console.warn(`⚠️  Nelze číst složku: public/${source.folder}`);
      continue;
    }

    if (files.length === 0) {
      console.warn(`⚠️  Složka je prázdná: public/${source.folder}`);
      continue;
    }

    console.log(`\n📂 ${source.folder} (${files.length} obrázků, kategorie: ${source.suggestedCategory})`);
    totalFound += files.length;

    let counter = 1;
    for (const file of files) {
      const srcPath = path.join(srcDir, file);
      const targetFilename = `${source.prefix}-horse-${String(counter).padStart(3, "0")}.webp`;
      const targetPath = path.join(TARGET_DIR, targetFilename);
      const publicPath = `${PUBLIC_BASE}/${targetFilename}`;
      const id = `${source.prefix}-horse-${String(counter).padStart(3, "0")}`;

      try {
        await sharp(srcPath)
          .resize(WEBP_OPTIONS.width, WEBP_OPTIONS.height, {
            fit: WEBP_OPTIONS.fit,
            background: WEBP_OPTIONS.background,
          })
          .webp({ quality: WEBP_OPTIONS.quality })
          .toFile(targetPath);

        console.log(`  ✓ ${file} → ${targetFilename}`);
        totalConverted++;
      } catch (err) {
        console.error(`  ✗ ${file} — konverze selhala: ${err.message}`);
        totalSkipped++;
        counter++;
        continue;
      }

      manifest.push({
        id,
        sourceFolder: source.folder,
        sourceFile: file,
        targetPath: publicPath,
        suggestedCategory: source.suggestedCategory,
        confirmedType: null,
        confirmedColor: null,
        confirmedRole: null,
        speed: null,
        maxStamina: null,
        notes: null,
      });

      counter++;
    }
  }

  // Zapsat manifest
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`
────────────────────────────────────
✅ Import dokončen

  Zdrojových složek:  ${SOURCES.length}
  Nalezeno obrázků:   ${totalFound}
  Převedeno WebP:     ${totalConverted}
  Přeskočeno/chyba:   ${totalSkipped}

  Výstupní složka:    public/themes/_shared/racers/imported/horses/
  Manifest:           data/racer-imports/horses.generated.json
────────────────────────────────────`);

  if (manifest.length > 0) {
    console.log("\nUkázka prvního záznamu:");
    console.log(JSON.stringify(manifest[0], null, 2));
  }
}

main().catch((err) => {
  console.error("❌ Script selhal:", err);
  process.exit(1);
});
