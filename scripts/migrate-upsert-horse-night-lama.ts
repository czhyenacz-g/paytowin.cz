/**
 * scripts/migrate-upsert-horse-night-lama.ts
 *
 * Vloží nebo přepíše závodníka horse_night_lama v tabulce `racers`.
 * Ostatní záznamy jsou nedotčeny.
 *
 * Spuštění:
 *   npx tsx scripts/migrate-upsert-horse-night-lama.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Načti .env.local ručně (dotenv není v projektu jako závislost)
const envPath = resolve(process.cwd(), ".env.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY v .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const LAMA_ROW = {
  id:          "horse_night_lama",
  name:        "La Negra",
  speed:       3,
  price:       1200,
  emoji:       "🦙",
  max_stamina: 100,
  is_legendary: false,
  flavor_text: "Ve tmě si ji spletli s koněm. Teď už je pozdě to přiznat.",
  image_path:  "/themes/_shared/racer-horse_night_lama.webp",
  image_url:   null,
  type:        "horse",
  is_builtin:  true,
  is_public:   true,
};

async function run() {
  console.log("Upserting horse_night_lama...");
  const { error } = await supabase.from("racers").upsert(LAMA_ROW);
  if (error) {
    console.error("Chyba:", error.message);
    process.exit(1);
  }

  // Ověření
  const { data, error: fetchErr } = await supabase
    .from("racers")
    .select("id, name, speed, price, is_builtin, is_public, image_path")
    .eq("id", "horse_night_lama")
    .single();

  if (fetchErr || !data) {
    console.error("Upsert proběhl, ale ověření selhalo:", fetchErr?.message);
    process.exit(1);
  }

  console.log("Hotovo:", data);
}

run();
