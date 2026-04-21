/**
 * _db/seed-builtin-racers.cjs — reset + seed built-in racerů do Supabase.
 *
 * Použití:
 *   node _db/seed-builtin-racers.cjs
 *
 * Vyžaduje NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY v .env.local.
 * Idempotentní: lze spustit opakovaně (DELETE is_builtin + upsert).
 */

const fs   = require("fs");
const path = require("path");

// Načti .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const env     = fs.readFileSync(envPath, "utf-8");
for (const line of env.split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
}

const { createClient } = require("../node_modules/@supabase/supabase-js/dist/index.cjs");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ─── Built-in racer data ──────────────────────────────────────────────────────
// Zdroj pravdy: lib/themes/horse-*.ts a car-*.ts (deduplication: první výskyt vyhrává)

const BUILTIN_RACERS = [
  // ── horse-day ──
  { id: "divoka_ruze",       name: "Divoká růže",    speed: 2,  price: 80,    emoji: "🌹", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  { id: "zlata_hriva",       name: "Zlatá hříva",    speed: 6,  price: 250,   emoji: "🟡", max_stamina: 90,  is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  { id: "r6",                name: "Pepík",          speed: 5,  price: 150,   emoji: "🐴", max_stamina: 100, is_legendary: false, flavor_text: "Pepó! Pepane! Pepíku!!",                                                                                          type: "horse" },
  { id: "rychly_vitr",       name: "Rychlý vítr",    speed: 9,  price: 400,   emoji: "🟢", max_stamina: 80,  is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  { id: "zeleznik",          name: "Železník",       speed: 10, price: 15000, emoji: "🐴", max_stamina: 10,  is_legendary: true,  flavor_text: "Železník — legendární kůň, který nezná strach, únavu ani druhé místo. Jeho jediný cíl je jasný: vyhrát.",        type: "horse" },
  // ── horse-night (unikátní) ──
  { id: "horse_night_buran", name: "Buran",          speed: 10, price: 150,   emoji: "🐴", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  // ── horse-classic ──
  { id: "sombra_roja",       name: "Sombra Roja",    speed: 2,  price: 80,    emoji: "🔴", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  { id: "viento_dorado",     name: "Viento Dorado",  speed: 3,  price: 150,   emoji: "🟤", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  { id: "el_relampago",      name: "El Relámpago",   speed: 4,  price: 250,   emoji: "⚡", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  { id: "caballo_real",      name: "Caballo Real",   speed: 5,  price: 400,   emoji: "👑", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  { id: "horse_classic_pablo", name: "Pablo",        speed: 7,  price: 150,   emoji: "🐴", max_stamina: 78,  is_legendary: false, flavor_text: null,                                                                                                               type: "horse" },
  // ── car-day ──
  { id: "stary_mustang",     name: "Starý Mustang",  speed: 2,  price: 80,    emoji: "🚗", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "car"   },
  { id: "modra_strela",      name: "Modrá střela",   speed: 3,  price: 150,   emoji: "🏎️", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "car"   },
  { id: "zlaty_blesk",       name: "Zlatý blesk",    speed: 4,  price: 250,   emoji: "🟡", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "car"   },
  { id: "rychly_demon",      name: "Rychlý démon",   speed: 5,  price: 400,   emoji: "🔥", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "car"   },
  { id: "car_day_r5",        name: "Tvoja mama",     speed: 8,  price: 150,   emoji: "🐴", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "car"   },
  // ── car-night (unikátní) ──
  { id: "car_night_r5",      name: "Tvuj tata",      speed: 8,  price: 150,   emoji: "🐴", max_stamina: 100, is_legendary: false, flavor_text: null,                                                                                                               type: "car"   },
];

// ─── Reset + seed ─────────────────────────────────────────────────────────────

async function main() {
  const ids = BUILTIN_RACERS.map(r => r.id);
  console.log(`\nReset + seed built-in racerů (${BUILTIN_RACERS.length} závodníků)…\n`);

  // 1. Smaž stávající built-in záznamy (reset)
  const { error: deleteErr, count } = await supabase
    .from("racers")
    .delete({ count: "exact" })
    .in("id", ids);

  if (deleteErr) {
    console.error("DELETE selhal:", deleteErr.message);
    process.exit(1);
  }
  console.log(`  ✓ Smazáno ${count ?? "?"} stávajících built-in záznamů`);

  // 2. Upsert všech built-in racerů
  const rows = BUILTIN_RACERS.map(r => ({
    ...r,
    is_builtin:  true,
    is_public:   true,
    image_url:   null,
    image_path:  null,
    owner_id:    null,
    updated_at:  new Date().toISOString(),
  }));

  const { error: upsertErr } = await supabase
    .from("racers")
    .upsert(rows, { onConflict: "id" });

  if (upsertErr) {
    console.error("UPSERT selhal:", upsertErr.message);
    process.exit(1);
  }

  console.log(`  ✓ Upsertováno ${rows.length} built-in závodníků`);
  console.log("\nIDs:\n" + ids.map(id => `  • ${id}`).join("\n"));
  console.log("\nHotovo.\n");
}

main().catch(e => { console.error(e); process.exit(1); });
