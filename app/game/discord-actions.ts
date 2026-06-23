"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";

const THEME_LABELS: Record<string, string> = {
  "horse-day":     "Dostihy — Den",
  "horse-night":   "Dostihy — Noc",
  "horse-classic": "Dostihy — Klasika",
  "car-day":       "Závody aut — Den",
  "car-night":     "Závody aut — Noc",
};

const BOARD_LABELS: Record<string, string> = {
  "small":         "Klasická deska",
  "small-stadium": "Stadion",
};

interface NotifyParams {
  gameCode: string;
  themeId?: string;
  boardId?: string;
  hasBot?: boolean;
  requireApproval?: boolean;
  maxPlayers?: number | null;
  ownerName?: string | null;
}

type NotifyResult =
  | { ok: true; threadUrl: string | null; warning?: string }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "discord_error"; status: number; details: string };

export async function notifyDiscordNewGameAction(params: NotifyParams): Promise<NotifyResult> {
  const botToken  = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_LOBBY_CHANNEL_ID;

  if (!botToken || !channelId) {
    return { ok: false, reason: "not_configured" };
  }

  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://paytowin.cz";
  const gameUrl  = `${baseUrl}/game/${params.gameCode}`;
  const themeName = (params.themeId ? THEME_LABELS[params.themeId] : null) ?? params.themeId ?? "Neznámá";
  const boardName = (params.boardId ? BOARD_LABELS[params.boardId] : null) ?? params.boardId ?? "—";

  const fields = [
    { name: "Mapa",   value: themeName,                                              inline: true },
    { name: "Deska",  value: boardName,                                              inline: true },
    { name: "Hráči",  value: `1 / ${params.maxPlayers ?? 32}`,                      inline: true },
    { name: "Bot",    value: params.hasBot           ? "Ano 🤖" : "Ne",             inline: true },
    { name: "Vstup",  value: params.requireApproval  ? "Vyžaduje schválení 🔐" : "Volný", inline: true },
    ...(params.ownerName ? [{ name: "Zakladatel", value: params.ownerName, inline: true }] : []),
  ];

  const payload = {
    content: "",
    embeds: [{
      title:       `🏁 Nová hra ${params.gameCode}`,
      description: "Na StartovníPole.cz byla založena nová online hra.",
      color:       0xf59e0b,
      fields,
      url:         gameUrl,
      footer:      { text: "StartovníPole.cz" },
    }],
    components: [{
      type: 1,
      components: [{
        type:  2,
        style: 5,
        label: "Připojit se →",
        url:   gameUrl,
      }],
    }],
  };

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    return { ok: false, reason: "discord_error", status: res.status, details };
  }

  // ── Thread creation ───────────────────────────────────────────────────────────

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    console.warn("[discord] DISCORD_GUILD_ID missing — thread not created");
    return { ok: true, threadUrl: null, warning: "DISCORD_GUILD_ID missing" };
  }

  let messageId: string | undefined;
  try {
    const msg = await res.json() as { id?: string };
    messageId = msg.id;
  } catch {
    console.warn("[discord] failed to parse announce message response");
    return { ok: true, threadUrl: null, warning: "announce message parse failed" };
  }

  if (!messageId) {
    console.warn("[discord] announce message missing id");
    return { ok: true, threadUrl: null, warning: "announce message id missing" };
  }

  const threadRes = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/threads`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name:                 `hra-${params.gameCode}`,
        auto_archive_duration: 10080, // 7 dní
      }),
    },
  );

  if (!threadRes.ok) {
    const details = await threadRes.text().catch(() => "");
    console.warn(`[discord] thread creation failed ${threadRes.status}: ${details}`);
    return { ok: true, threadUrl: null, warning: `thread creation failed (${threadRes.status})` };
  }

  let threadId: string | undefined;
  try {
    const thread = await threadRes.json() as { id?: string };
    threadId = thread.id;
  } catch {
    console.warn("[discord] failed to parse thread response");
    return { ok: true, threadUrl: null, warning: "thread response parse failed" };
  }

  if (!threadId) {
    console.warn("[discord] thread response missing id");
    return { ok: true, threadUrl: null, warning: "thread id missing" };
  }

  const threadUrl = `https://discord.com/channels/${guildId}/${threadId}`;

  // Uložit thread URL do DB (server-side — nespolehne se na client Promise)
  await supabaseAdmin
    .from("games")
    .update({ discord_thread_url: threadUrl })
    .eq("code", params.gameCode)
    .then(({ error }) => {
      if (error) console.warn("[discord] failed to save thread url:", error.message);
    });

  // Úvodní zpráva v threadu
  await fetch(
    `https://discord.com/api/v10/channels/${threadId}/messages`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: `👋 Zde si domluvte tah — hra: ${gameUrl}` }),
    },
  ).catch((err: unknown) => {
    console.warn("[discord] thread welcome message failed:", err);
  });

  return { ok: true, threadUrl };
}
