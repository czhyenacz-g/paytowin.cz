/**
 * lib/racers/storage.ts — upload racer image do Supabase Storage.
 *
 * Bucket:   "racers"  (vytvoř v Supabase dashboard, public read, napiš policy pro service role)
 * Path:     {racer_id}.webp
 * Formát:   WebP, 512×512 contain, transparent background, quality 85
 *
 * Konverze zajišťuje sharp — tranzitivní závislost next.js, dostupná server-side.
 * Importovat jen ze server-side kódu (Server Actions, lib/).
 *
 * Požadavky na prostředí:
 *   SUPABASE_SERVICE_ROLE_KEY v .env.local — bez něj upload selže (viz lib/supabase-admin.ts)
 */

import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "racers";
/** Maximální velikost přijatého souboru (10 MB). */
const MAX_BYTES = 10 * 1024 * 1024;

// ─── Typy ─────────────────────────────────────────────────────────────────────

export type ImageUploadResult =
  | { ok: true;  publicUrl: string; path: string }
  | { ok: false; error: string };

// ─── WebP konverze ────────────────────────────────────────────────────────────

/**
 * toWebp — převede vstupní buffer do WebP 512×512 cover (center crop, bez paddingu).
 *
 * Dynamic import sharp — modul zůstane server-only; tree-shaker nepromítne do bundlu.
 * Pokud sharp není dostupný (edge runtime), výjimka se propaguje do volajícího.
 */
async function toWebp(input: Buffer): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharp = (await import("sharp")).default;
  return sharp(input)
    .resize(512, 512, {
      fit:        "cover",
    })
    .webp({ quality: 85 })
    .toBuffer();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * uploadRacerImage — převede soubor na WebP a nahraje do bucketu "racers".
 *
 * Existující soubor pro daný racerId je přepsán (upsert).
 * Po úspěšném uploadu vrátí veřejnou URL a path v bucketu.
 *
 * @param racerId  Slug závodníka — stane se názvem souboru (bez přípony).
 * @param input    Obsah souboru jako ArrayBuffer (z File.arrayBuffer()).
 */
export async function uploadRacerImage(
  racerId: string,
  input: ArrayBuffer,
): Promise<ImageUploadResult> {
  if (input.byteLength > MAX_BYTES) {
    return { ok: false, error: `Soubor je příliš velký — maximum je ${MAX_BYTES / 1024 / 1024} MB.` };
  }

  let webpBuffer: Buffer;
  try {
    webpBuffer = await toWebp(Buffer.from(input));
  } catch (e) {
    return {
      ok:    false,
      error: `WebP konverze selhala: ${String(e)}. Sharp musí být dostupný na serveru.`,
    };
  }

  const path = `${racerId}.webp`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, webpBuffer, {
      contentType: "image/webp",
      upsert:      true,
    });

  if (error) {
    return {
      ok:    false,
      error: `Upload do storage selhal: ${error.message}. ` +
        "Zkontroluj: bucket 'racers' existuje, SUPABASE_SERVICE_ROLE_KEY je nastaven.",
    };
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, publicUrl: urlData.publicUrl, path };
}
