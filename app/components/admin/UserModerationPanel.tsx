"use client";

import React from "react";
import { banUserAction, unbanUserAction } from "@/app/admin/users/actions";
import type { UserModerationRecord } from "@/lib/users/moderation";

interface UserModerationPanelProps {
  userId: string;
  moderation: UserModerationRecord | null;
}

export default function UserModerationPanel({ userId, moderation }: UserModerationPanelProps) {
  const isBanned = moderation?.status === "banned";
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const handleBan = async () => {
    if (!reason.trim()) {
      setMessage({ ok: false, text: "Zadej důvod zákazu." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const result = await banUserAction(userId, reason);
    setLoading(false);
    if (result.ok) {
      setMessage({ ok: true, text: "Hráč byl zakázán." });
      setReason("");
    } else {
      setMessage({ ok: false, text: result.error });
    }
  };

  const handleUnban = async () => {
    setLoading(true);
    setMessage(null);
    const result = await unbanUserAction(userId);
    setLoading(false);
    if (result.ok) {
      setMessage({ ok: true, text: "Hráč byl odblokován." });
    } else {
      setMessage({ ok: false, text: result.error });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">Moderace</h2>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">Stav:</span>
        {isBanned ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            Zakázaný
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            Aktivní
          </span>
        )}
      </div>

      {isBanned && moderation && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 space-y-1">
          {moderation.ban_reason && (
            <p><span className="font-semibold">Důvod:</span> {moderation.ban_reason}</p>
          )}
          {moderation.banned_at && (
            <p>
              <span className="font-semibold">Zakázán:</span>{" "}
              {new Date(moderation.banned_at).toLocaleString("cs-CZ")}
            </p>
          )}
        </div>
      )}

      {message && (
        <div
          className={`rounded-xl p-3 text-sm ${
            message.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {!isBanned ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Důvod zákazu
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Např. spam, cheating…"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <button
            onClick={handleBan}
            disabled={loading}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Zakázat hráče"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleUnban}
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : "Odblokovat hráče"}
        </button>
      )}
    </div>
  );
}
