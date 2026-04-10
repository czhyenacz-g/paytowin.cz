import { createClient } from "@supabase/supabase-js";

// Untyped client — vlastní typy jsou v database.types.ts a používají se lokálně
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
