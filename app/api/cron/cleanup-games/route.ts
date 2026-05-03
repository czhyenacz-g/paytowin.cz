import { supabaseAdmin } from "@/lib/supabase-admin";

// waiting hry starší 48h → cancelled
const WAITING_TTL_MS = 48 * 60 * 60 * 1000;
// playing hry bez aktivity 7 dní → cancelled (dle game_state.updated_at)
const PLAYING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel cron posílá Authorization: Bearer <CRON_SECRET> automaticky
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  // Fallback pro manuální volání: ?secret=...
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!isAuthorized(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const waitingCutoff = new Date(now - WAITING_TTL_MS).toISOString();
  const playingCutoff  = new Date(now - PLAYING_TTL_MS).toISOString();

  try {
    // ── 1. Waiting hry expirované dle created_at ─────────────────────────────
    const { data: stalWaiting, error: swErr } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("status", "waiting")
      .lt("created_at", waitingCutoff);

    if (swErr) throw new Error(`select waiting: ${swErr.message}`);

    let cancelledWaiting = 0;
    if (stalWaiting && stalWaiting.length > 0) {
      const ids = stalWaiting.map(r => r.id);
      const { error: uwErr } = await supabaseAdmin
        .from("games")
        .update({ status: "cancelled" })
        .in("id", ids)
        .eq("status", "waiting"); // guard: nepřepisuj hry, které mezitím přešly dál
      if (uwErr) throw new Error(`update waiting: ${uwErr.message}`);
      cancelledWaiting = ids.length;
    }

    // ── 2. Playing hry bez aktivity dle game_state.updated_at ────────────────
    const { data: staleStates, error: ssErr } = await supabaseAdmin
      .from("game_state")
      .select("game_id")
      .lt("updated_at", playingCutoff);

    if (ssErr) throw new Error(`select game_state: ${ssErr.message}`);

    let cancelledPlaying = 0;
    if (staleStates && staleStates.length > 0) {
      const staleIds = staleStates.map(r => r.game_id);
      const { error: upErr } = await supabaseAdmin
        .from("games")
        .update({ status: "cancelled" })
        .in("id", staleIds)
        .eq("status", "playing"); // guard: pouze skutečně playing hry
      if (upErr) throw new Error(`update playing: ${upErr.message}`);
      // count kolik jich skutečně bylo playing — select before update není atomický,
      // takže vracíme počet stale game_states jako horní odhad
      cancelledPlaying = staleIds.length;
    }

    return Response.json({
      ok: true,
      cancelledWaiting,
      cancelledPlaying,
      waitingCutoff,
      playingCutoff,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
