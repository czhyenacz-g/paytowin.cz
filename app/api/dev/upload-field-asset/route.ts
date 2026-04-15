/**
 * POST /api/dev/upload-field-asset
 *
 * Dev-only API route pro uložení field asset souborů do public/themes/{themeId}/.
 * Aktivní POUZE v development módu (NODE_ENV !== 'production').
 *
 * Zpracování obrazu (resize, WebP konverze) proběhlo na klientu přes Canvas API.
 * Tento route pouze validuje vstup a bezpečně uloží soubory na správné místo.
 *
 * FormData parametry:
 *   themeId   — ID tématu, např. "horse-day" nebo "community/sea-world"
 *   fieldType — typ pole, např. "coins_gain"
 *   png       — PNG soubor (File)
 *   webp      — WebP soubor (File), může být PNG-encoded pokud browser nepodporuje WebP
 *
 * Response:
 *   { ok: true, webpPath, pngPath, canonicalFile }
 *   nebo { error: string } při chybě
 *
 * Bezpečnost:
 *   - Blokováno v production
 *   - themeId validován regexem (no path traversal)
 *   - fieldType validován proti whitelist
 *   - Výsledná cesta ověřena proti public/themes/ (path.resolve check)
 *   - Vstupní soubory omezeny na 10 MB
 */

import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fieldAssetKey, racerAssetFilename, THEME_ASSETS } from "@/lib/themes/assets";

// ─── Whitelist ────────────────────────────────────────────────────────────────

const VALID_FIELD_TYPES = new Set<string>([
  "start",
  "coins_gain",
  "coins_lose",
  "gamble",
  "racer",
  "neutral",
  "chance",
  "finance",
]);

/** Povolené znaky: lowercase, číslice, pomlčka, podtržítko, lomítko (pro community/sea-world) */
const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9/_-]*[a-z0-9]$|^[a-z0-9]$/;
const RACER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB vstupní limit

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // ── Dev guard ──────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Tento endpoint je dostupný pouze v development módu." },
      { status: 403 },
    );
  }

  // ── Parse FormData ─────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Nelze přečíst FormData." }, { status: 400 });
  }

  const themeId  = (formData.get("themeId")   as string | null) ?? "";
  const fieldType = (formData.get("fieldType") as string | null) ?? "";
  const racerId = (formData.get("racerId") as string | null) ?? "";
  const pngFile  = formData.get("png")  as File | null;
  const webpFile = formData.get("webp") as File | null;

  // ── Validace vstupů ────────────────────────────────────────────────────────

  if (!themeId || !THEME_ID_PATTERN.test(themeId)) {
    return NextResponse.json(
      { error: `Neplatné themeId: "${themeId}". Povolené znaky: a-z, 0-9, -, _, /` },
      { status: 400 },
    );
  }

  if (fieldType && racerId) {
    return NextResponse.json(
      { error: "Pošli buď fieldType, nebo racerId, ne oboje zároveň." },
      { status: 400 },
    );
  }

  if (!fieldType && !racerId) {
    return NextResponse.json(
      { error: "Chybí fieldType nebo racerId." },
      { status: 400 },
    );
  }

  if (fieldType && !VALID_FIELD_TYPES.has(fieldType)) {
    return NextResponse.json(
      { error: `Neplatný fieldType: "${fieldType}". Povolené: ${[...VALID_FIELD_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  if (racerId && !RACER_ID_PATTERN.test(racerId)) {
    return NextResponse.json(
      { error: `Neplatné racerId: "${racerId}". Povolené znaky: a-z, 0-9, -, _` },
      { status: 400 },
    );
  }

  if (!pngFile && !webpFile) {
    return NextResponse.json({ error: "Žádné soubory nebyly nahrány." }, { status: 400 });
  }

  // ── Canonical filename ─────────────────────────────────────────────────────
  let webpFilename: string;
  if (racerId) {
    webpFilename = racerAssetFilename(racerId);
  } else {
    const assetKey = fieldAssetKey(fieldType);
    if (!assetKey) {
      return NextResponse.json(
        { error: `Pro fieldType "${fieldType}" nebyl nalezen asset klíč.` },
        { status: 400 },
      );
    }
    webpFilename = THEME_ASSETS[assetKey];
  }

  const pngFilename  = webpFilename.replace(".webp", ".png"); // např. "field-gain.png"

  // ── Bezpečná cesta — musí zůstat uvnitř public/themes/ ────────────────────

  // themeId může obsahovat "/" pro community/sea-world — split zajistí správné path.join
  const themeSegments = themeId.split("/").filter(Boolean);
  const themeDirAbsolute = path.resolve(
    process.cwd(),
    "public",
    "themes",
    ...themeSegments,
  );
  const publicThemesDir = path.resolve(process.cwd(), "public", "themes");

  if (!themeDirAbsolute.startsWith(publicThemesDir + path.sep) &&
      themeDirAbsolute !== publicThemesDir) {
    return NextResponse.json({ error: "Neplatná cesta tématické složky." }, { status: 400 });
  }

  // ── Uložení souborů ────────────────────────────────────────────────────────

  await mkdir(themeDirAbsolute, { recursive: true });

  const savedPaths: { webpPath?: string; pngPath?: string } = {};

  if (webpFile) {
    const bytes = await webpFile.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "WebP soubor je příliš velký (max 10 MB)." }, { status: 400 });
    }
    await writeFile(path.join(themeDirAbsolute, webpFilename), Buffer.from(bytes));
    savedPaths.webpPath = `/themes/${themeId}/${webpFilename}`;
  }

  if (pngFile) {
    const bytes = await pngFile.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "PNG soubor je příliš velký (max 10 MB)." }, { status: 400 });
    }
    await writeFile(path.join(themeDirAbsolute, pngFilename), Buffer.from(bytes));
    savedPaths.pngPath = `/themes/${themeId}/${pngFilename}`;
  }

  return NextResponse.json({
    ok: true,
    webpPath:      savedPaths.webpPath ?? null,
    pngPath:       savedPaths.pngPath  ?? null,
    themeId,
    fieldType: fieldType || null,
    racerId: racerId || null,
    canonicalFile: webpFilename,
  });
}
