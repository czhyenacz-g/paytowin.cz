/**
 * lib/morse.ts — převod textu do mezinárodní morseovy abecedy.
 *
 * Podporuje A–Z, 0–9, mezeru mezi slovy.
 * Diakritika je normalizována na ASCII před převodem.
 */

const MORSE_MAP: Record<string, string> = {
  A: "·−",   B: "−···", C: "−·−·", D: "−··",  E: "·",
  F: "··−·", G: "−−·",  H: "····", I: "··",   J: "·−−−",
  K: "−·−",  L: "·−··", M: "−−",   N: "−·",   O: "−−−",
  P: "·−−·", Q: "−−·−", R: "·−·",  S: "···",  T: "−",
  U: "··−",  V: "···−", W: "·−−",  X: "−··−", Y: "−·−−",
  Z: "−−··",
  "0": "−−−−−", "1": "·−−−−", "2": "··−−−", "3": "···−−",
  "4": "····−", "5": "·····", "6": "−····", "7": "−−···",
  "8": "−−−··", "9": "−−−−·",
};

const DIACRITIC_MAP: Record<string, string> = {
  á: "a", č: "c", ď: "d", é: "e", ě: "e", í: "i", ň: "n",
  ó: "o", ř: "r", š: "s", ť: "t", ú: "u", ů: "u", ý: "y", ž: "z",
  Á: "A", Č: "C", Ď: "D", É: "E", Ě: "E", Í: "I", Ň: "N",
  Ó: "O", Ř: "R", Š: "S", Ť: "T", Ú: "U", Ů: "U", Ý: "Y", Ž: "Z",
};

function normalizeDiacritics(text: string): string {
  return text.split("").map(c => DIACRITIC_MAP[c] ?? c).join("");
}

/**
 * extractCapsSegment — vrátí první CAPS segment textu pro audio morse cue.
 *
 * Bere znaky od začátku: velká písmena (včetně českých), číslice, mezery.
 * Zastaví se na prvním oddělovači (—, :, –) nebo na přechodu na malé písmeno.
 *
 * Příklady:
 *   "SENZACE — 1921: ..."   → "SENZACE"
 *   "KRACH NA BURZE — 1929" → "KRACH NA BURZE"
 *   "VAROVÁNÍ — 1924: ..."  → "VAROVÁNÍ"
 *
 * Pokud segment není nalezen, vrátí prázdný řetězec → žádné audio.
 */
export function extractCapsSegment(text: string): string {
  const match = text.match(/^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9 ]+)/);
  return match ? match[1].trim() : "";
}

/**
 * textToMorse — převede text na morseovku.
 * Slova jsou oddělena " / ", znaky mezerou.
 * Neznámé znaky jsou přeskočeny.
 */
export function textToMorse(text: string): string {
  const normalized = normalizeDiacritics(text).toUpperCase();
  return normalized
    .split(" ")
    .map(word =>
      word
        .split("")
        .map(ch => MORSE_MAP[ch])
        .filter(Boolean)
        .join(" ")
    )
    .filter(w => w.length > 0)
    .join("  /  ");
}
