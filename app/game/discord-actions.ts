"use server";

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
  | { ok: true }
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
      description: "Na PayToWin.cz byla založena nová online hra.",
      color:       0xf59e0b,
      fields,
      url:         gameUrl,
      footer:      { text: "PayToWin.cz" },
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

  return { ok: true };
}
