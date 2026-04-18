/**
 * lib/supabase-admin.ts — server-only Supabase admin client.
 *
 * Používá SUPABASE_SERVICE_ROLE_KEY pro privilegované operace (upload do storage apod.).
 * NIKDY neimportovat v client komponentách.
 *
 * Nastavení:
 *   Přidej do .env.local:  SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
 *   Klíč najdeš v Supabase dashboard → Project Settings → API → service_role.
 *
 * Fallback:
 *   Pokud klíč chybí, client použije anon key — upload selže pokud bucket
 *   nemá nastavenu policy "allow all uploads" (není vhodné pro produkci).
 */

import { createClient } from "@supabase/supabase-js";

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.warn(
    "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY není nastaven. " +
    "Přidej jej do .env.local pro upload obrázků do storage. " +
    "Fallback na anon key — upload selže pokud bucket nemá public write policy.",
  );
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // Vždy použij non-null assertion — pokud chybí URL, app se rozbije dřív
  serviceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
