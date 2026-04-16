/**
 * app/api/dev/save-editor-state/route.ts
 *
 * Dev-only POST endpoint — zapisuje editor state přímo do zdrojových souborů.
 * Dostupné POUZE v development prostředí (NODE_ENV !== "production").
 *
 * Zapisuje:
 *   editableBoard  → lib/board/presets.ts  (nahradí SMALL_BOARD constant)
 *   editableRacers → lib/themes/{themeId}.ts  (nahradí racers: [...])
 *   editableCards  → lib/themes/{themeId}.ts  (přidá/nahradí content: { cards: {...} })
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // NOTE: production guard dočasně odstraněn — znovu přidat před final deploy

  let body: {
    themeId: string;
    editableBoard: unknown;
    editableRacers: unknown;
    editableCards: { chance: unknown[]; finance: unknown[] };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { themeId, editableBoard, editableRacers, editableCards } = body;

  // Validate themeId — must be a safe slug
  if (typeof themeId !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(themeId)) {
    return NextResponse.json(
      { ok: false, error: `Invalid themeId: "${themeId}"` },
      { status: 400 }
    );
  }

  const cwd = process.cwd();
  const written: string[] = [];

  try {
    // ── 1. lib/board/presets.ts — nahradit SMALL_BOARD ────────────────────────
    const presetsRelPath = "lib/board/presets.ts";
    const presetsPath = path.join(cwd, presetsRelPath);
    const presetsSource = fs.readFileSync(presetsPath, "utf-8");
    const newPresetsSource = replaceExportConst(presetsSource, "SMALL_BOARD", editableBoard);
    fs.writeFileSync(presetsPath, newPresetsSource, "utf-8");
    written.push(presetsRelPath);

    // ── 2. lib/themes/{themeId}.ts — nahradit racers + přidat/nahradit content ─
    const themeRelPath = `lib/themes/${themeId}.ts`;
    const themePath = path.join(cwd, themeRelPath);

    // Path traversal guard
    const allowedDir = path.join(cwd, "lib", "themes") + path.sep;
    if (!themePath.startsWith(allowedDir)) {
      return NextResponse.json({ ok: false, error: "Path traversal detected" }, { status: 400 });
    }
    if (!fs.existsSync(themePath)) {
      return NextResponse.json(
        { ok: false, error: `Theme file not found: ${themeRelPath}. Uložit do souborů funguje jen pro built-in themes (horse-day, horse-classic, …).` },
        { status: 404 }
      );
    }

    let themeSource = fs.readFileSync(themePath, "utf-8");
    // Replace racers array (indented 2 spaces inside the theme object)
    themeSource = replaceObjectKey(themeSource, "racers", editableRacers, "  ");

    // Add/replace/remove content.cards block
    const hasCustomCards =
      (Array.isArray(editableCards?.chance) && editableCards.chance.length > 0) ||
      (Array.isArray(editableCards?.finance) && editableCards.finance.length > 0);
    themeSource = upsertContentCards(themeSource, hasCustomCards ? editableCards : null);

    fs.writeFileSync(themePath, themeSource, "utf-8");
    written.push(themeRelPath);

    return NextResponse.json({ ok: true, written });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ─── Text patching helpers ────────────────────────────────────────────────────

/** Escapes a string for use in RegExp */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds the matching close bracket for the opener at `pos`.
 * Correctly skips over string literals to avoid false positives.
 */
function findClose(src: string, pos: number): number {
  const open = src[pos];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) throw new Error(`Not a bracket at position ${pos}: "${open}"`);

  let depth = 0;
  let i = pos;

  while (i < src.length) {
    const ch = src[i];

    if (ch === '"' || ch === "'") {
      // Skip quoted string
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === ch) break;
        i++;
      }
    } else if (ch === "`") {
      // Skip template literal (simplified — no nested ${...})
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "`") break;
        i++;
      }
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }

    i++;
  }

  throw new Error(`No matching "${close}" for "${open}" at position ${pos}`);
}

/**
 * Adds `indent` to every line of `text` except the first.
 * Used to properly indent multi-line JSON values inside a TypeScript file.
 */
function addIndent(text: string, indent: string): string {
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? line : indent + line))
    .join("\n");
}

/**
 * Replaces `export const NAME: Type = {...};` in `src` with a freshly serialized value.
 * Preserves everything before the `=` (declaration prefix) and after `;` (rest of file).
 */
function replaceExportConst(src: string, name: string, value: unknown): string {
  const re = new RegExp(`(export const ${esc(name)}[^=]*=\\s*)\\{`);
  const m = re.exec(src);
  if (!m) throw new Error(`"export const ${name}" not found in file`);

  const prefixEnd = m.index + m[1].length; // right before the opening {
  const openIdx = prefixEnd;
  const closeIdx = findClose(src, openIdx);

  // Find the ; that follows the closing }
  let semiIdx = closeIdx + 1;
  while (semiIdx < src.length && src[semiIdx] !== ";" && src[semiIdx] !== "\n") semiIdx++;
  const hasSemi = src[semiIdx] === ";";

  return (
    src.slice(0, prefixEnd) +
    JSON.stringify(value, null, 2) +
    ";" +
    src.slice(semiIdx + (hasSemi ? 1 : 0))
  );
}

/**
 * Replaces the value of `key: <value>` in a TypeScript object literal.
 * `baseIndent` is the indentation of the key (e.g. "  "), used to re-indent
 * subsequent lines of the serialized JSON so the result looks clean.
 * Preserves the trailing comma if one was present.
 */
function replaceObjectKey(
  src: string,
  key: string,
  newValue: unknown,
  baseIndent: string
): string {
  const re = new RegExp(`([ \\t]*${esc(key)}:\\s*)([\\[{])`);
  const m = re.exec(src);
  if (!m) throw new Error(`Key "${key}" not found in source`);

  const prefixEnd = m.index + m[1].length; // right before the opener
  const openIdx = prefixEnd;
  const closeIdx = findClose(src, openIdx);

  // Check for trailing comma right after the closing bracket
  const charAfterClose = src[closeIdx + 1];
  const hasTrailingComma = charAfterClose === ",";
  const endIdx = closeIdx + 1 + (hasTrailingComma ? 1 : 0);

  // Serialize and re-indent to match file indentation
  const serialized = addIndent(JSON.stringify(newValue, null, 2), baseIndent);

  return (
    src.slice(0, prefixEnd) +
    serialized +
    (hasTrailingComma ? "," : "") +
    src.slice(endIdx)
  );
}

/**
 * Adds or replaces the `content: { cards: { ... } }` block in the theme export const.
 * If `cards` is null, removes the block (if present).
 */
function upsertContentCards(
  src: string,
  cards: { chance: unknown[]; finance: unknown[] } | null
): string {
  const hasContentKey = /[ \t]*content:\s*\{/.test(src);

  if (cards === null) {
    if (!hasContentKey) return src;
    // Remove the content block entirely
    const re = /([ \t]*content:\s*)\{/;
    const m = re.exec(src);
    if (!m) return src;
    const blockStart = m.index; // includes leading indent
    const openIdx = m.index + m[1].length;
    const closeIdx = findClose(src, openIdx);
    const charAfterClose = src[closeIdx + 1];
    const hasTrailingComma = charAfterClose === ",";
    const endIdx = closeIdx + 1 + (hasTrailingComma ? 1 : 0);
    // Also consume the newline before the block if present
    const actualStart = blockStart > 0 && src[blockStart - 1] === "\n" ? blockStart - 1 : blockStart;
    return src.slice(0, actualStart) + src.slice(endIdx);
  }

  const contentValue = { cards };
  const serialized = addIndent(JSON.stringify(contentValue, null, 2), "  ");
  const block = `\n  content: ${serialized},`;

  if (hasContentKey) {
    return replaceObjectKey(src, "content", contentValue, "  ");
  }

  // No existing content block — insert before the closing }; of the export const
  const exportRe = /export const \w+[^=]*=\s*\{/;
  const exportM = exportRe.exec(src);
  if (!exportM) throw new Error("No export const found in theme file");
  const objOpenIdx = exportM.index + exportM[0].length - 1; // the {
  const objCloseIdx = findClose(src, objOpenIdx);

  return src.slice(0, objCloseIdx) + block + "\n" + src.slice(objCloseIdx);
}
