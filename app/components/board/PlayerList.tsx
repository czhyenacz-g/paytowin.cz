"use client";

import { isBankrupt, racerOwnershipKey } from "@/lib/engine";
import type { Field } from "@/lib/engine";
import type { Player, Horse, GameState } from "@/lib/types/game";
import type { Theme, RacerConfig } from "@/lib/themes";
import { getThemeRacers } from "@/lib/themes";
import { UI_TEXT } from "@/lib/ui-text";
import type { SoundId } from "@/lib/audio/sfx";

function racerSoundType(h: { id?: string }, themeRacers: RacerConfig[]): "horse" | "car" | null {
  if (!h.id) return null;
  const cfg = themeRacers.find(r => r.id === h.id);
  if (cfg?.racerType === "horse") return "horse";
  if (cfg?.racerType === "car") return "car";
  return null;
}

interface Props {
  players: Player[];
  gameState: GameState | null;
  theme: Theme;
  FIELDS: Field[];
  isLocalGame: boolean;
  myPlayerId: string | null;
  myDiscordAvatar: string | null;
  hoveredPlayerId: string | null;
  setHoveredPlayerId: (id: string | null) => void;
  viewerRole: string;
  setPreferredRacer: (playerId: string, key: string | null) => void;
  sellRacerToBank: (player: Player, horse: Horse) => void;
  playSfx: (id: SoundId) => void;
}

export default function PlayerList({
  players,
  gameState,
  theme,
  FIELDS,
  isLocalGame,
  myPlayerId,
  myDiscordAvatar,
  hoveredPlayerId,
  setHoveredPlayerId,
  viewerRole,
  setPreferredRacer,
  sellRacerToBank,
  playSfx,
}: Props) {
  return (
    <>
      <div className="border-t border-black/[0.06] my-1" />
      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{UI_TEXT.board.playersTitle}</div>
        <div className="space-y-2">
          {players.map((player, index) => {
            const isCurrent = gameState?.current_player_index === index;
            const bankrupt = isBankrupt(player);
            const field = FIELDS[player.position];
            // Discord avatar: preferuj player.discord_avatar_url (uložen v DB při joinu).
            // Fallback pro vlastního hráče: session avatar (pro případ starých záznamů bez DB pole).
            const isMe = !isLocalGame && player.id === myPlayerId;
            const avatarUrl = player.discord_avatar_url ?? (isMe ? myDiscordAvatar : null);
            const showAvatar = !!avatarUrl;
            return (
              <div
                key={player.id}
                onMouseEnter={() => !bankrupt && setHoveredPlayerId(player.id)}
                onMouseLeave={() => setHoveredPlayerId(null)}
                className={`rounded-[4px] border-2 p-3 transition-all cursor-default ${
                  bankrupt
                    ? "border-red-200 bg-red-50/50 opacity-35"
                    : hoveredPlayerId === player.id
                    ? theme.colors.playerCardHover
                    : isCurrent
                    ? `${theme.colors.playerCardActive} shadow-md`
                    : theme.colors.playerCardNormal
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {showAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl!}
                          alt=""
                          className={`h-8 w-8 shrink-0 rounded-full object-cover ring-2 shadow ${bankrupt ? "ring-slate-300 opacity-40" : "ring-black/20"}`}
                        />
                      ) : (
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-black ring-2 ring-black/20 shadow ${bankrupt ? "bg-slate-400" : player.color}`}>
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className={`flex items-center gap-1.5 font-semibold text-sm leading-tight ${bankrupt ? "text-slate-400 line-through" : theme.colors.textPrimary}`}>
                          {player.name}
                          {player.is_bot && (
                            <span className="shrink-0 rounded-[3px] bg-slate-200 px-1 py-0 text-[9px] font-bold uppercase tracking-widest text-slate-500">BOT</span>
                          )}
                        </div>
                        {bankrupt ? (
                          <div className="text-xs font-semibold text-red-500">{UI_TEXT.board.bankruptLabel}</div>
                        ) : (
                          <div className={`text-xs truncate ${theme.colors.textMuted}`}>{field?.emoji} {field?.label}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className={`text-sm font-bold ${bankrupt ? "text-red-400" : theme.colors.textPrimary}`}>
                        {player.coins} 💰
                      </div>
                      {isCurrent && !bankrupt && (
                        <div className={`rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${theme.colors.activePlayerBadge}`}>
                          {UI_TEXT.board.activePlayerBadge}
                        </div>
                      )}
                    </div>
                  </div>
                  {!bankrupt && player.horses.length > 0 && (
                    <div className="border-t border-black/8 pt-2 space-y-1.5">
                      {[...player.horses]
                        .sort((a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0))
                        .map((h) => {
                          const hKey = racerOwnershipKey(h);
                          const isOwn = isLocalGame ? viewerRole === "player" : player.id === myPlayerId;
                          return (
                            <div
                              key={hKey}
                              className={`rounded-[3px] px-2.5 py-2 text-xs ${
                                h.isPreferred
                                  ? "border border-yellow-200 bg-yellow-50"
                                  : "border border-black/[0.06] bg-slate-50"
                              }`}
                              onMouseEnter={() => {
                                const rst = racerSoundType(h, getThemeRacers(theme));
                                if (rst === "horse") playSfx("hoof_hover");
                                else if (rst === "car") playSfx("engine_hover");
                              }}
                            >
                              <div className={`flex items-start gap-2 text-sm font-semibold leading-snug ${h.isPreferred ? "text-amber-700" : "text-slate-700"}`}>
                                {h.image
                                  ? ( // eslint-disable-next-line @next/next/no-img-element
                                    <img src={h.image} alt={h.name} className="mt-0.5 h-6 w-6 shrink-0 rounded object-cover bg-slate-100" onError={(e) => { e.currentTarget.style.display = "none"; }} />)
                                  : <span className="mt-0.5 shrink-0 text-base">{h.emoji}</span>
                                }
                                <span className="min-w-0 flex-1 break-words">
                                  {h.name}
                                </span>
                              </div>
                              <div className="mt-1.5 ml-6 inline-flex max-w-full flex-wrap items-center gap-1.5">
                                <span className="whitespace-nowrap rounded-[2px] bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  ⚡ {h.speed}
                                </span>
                                <span className="whitespace-nowrap rounded-[2px] bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  {UI_TEXT.board.staminaLabel} {h.stamina ?? h.maxStamina ?? 100}%
                                </span>
                                {isOwn ? (
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    {h.isPreferred && (
                                      <span className="rounded-[2px] bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                                        {UI_TEXT.board.preferredBadge}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => setPreferredRacer(player.id, h.isPreferred ? null : hKey)}
                                      className={`shrink-0 text-sm leading-none transition-colors ${
                                        h.isPreferred
                                          ? "text-amber-400 hover:text-slate-300"
                                          : "text-slate-300 hover:text-amber-400"
                                      }`}
                                      title={h.isPreferred ? "Odnastavit hlavního závodníka" : "Nastavit jako hlavního závodníka"}
                                    >
                                      {h.isPreferred ? "★" : "☆"}
                                    </button>
                                    {isCurrent && !gameState?.horse_pending && !gameState?.card_pending && !gameState?.offer_pending && (
                                      <button
                                        onClick={() => sellRacerToBank(player, h)}
                                        className="shrink-0 rounded-[2px] bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                        title={`Prodat bance za ${Math.floor(h.price * 0.8)} 💰 (80 % ceny)`}
                                      >
                                        Prodat
                                      </button>
                                    )}
                                  </span>
                                ) : h.isPreferred ? (
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    <span className="rounded-[2px] bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                                      Hlavní
                                    </span>
                                    <span className="shrink-0 text-sm leading-none text-amber-400">★</span>
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
