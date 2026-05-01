import type { Field } from "@/lib/engine";

export function getFieldDetail(field: Field, ownerName: string | null): string | null {
  if (field.type === "neutral") return null;
  if (field.type === "racer") {
    if (!field.racer) return null;
    if (ownerName) return `✓ ${ownerName}`;
    return `${field.racer.price} 💰 ${"⭐".repeat(Math.min(field.racer.speed, 5))}`;
  }
  if (field.type === "chance")  return "🎴 náhodná karta";
  if (field.type === "finance") return "💼 finance karta";
  if (field.type === "mafia")   return "🎭 Mafie karta";
  if (field.type === "gamble")  return "🎲 hazard";
  return field.description || null;
}

export function getFieldMetaLabel(field: Field, ownerName: string | null): string | null {
  if (field.type === "start") return "START";
  if (field.type === "racer") {
    if (!field.racer) return null;
    if (ownerName) return "obsazeno";
    return `${field.racer.price} 💰`;
  }
  if (field.type === "coins_gain") return field.description || "odměna";
  if (field.type === "coins_lose") return field.description || "ztráta";
  if (field.type === "chance") return "osud";
  if (field.type === "finance") return "Finance";
  if (field.type === "mafia")   return "Mafie";
  if (field.type === "gamble") return "hazard";
  return field.description || null;
}

/**
 * Barva akcentní horní hrany karty (strana od středu).
 * Nezávislé na theme — jde o herní sémantiku pole.
 */
export function getFieldAccentColor(field: Field): string {
  switch (field.type) {
    case "start":      return "#ef4444";
    case "coins_gain": return "#34d399";
    case "coins_lose": return "#f87171";
    case "gamble":     return "#c084fc";
    case "racer":
    case "horse":      return "#fbbf24";
    case "chance":     return "#38bdf8";
    case "finance":    return "#38bdf8";
    case "mafia":      return "#a855f7";
    default:           return "#94a3b8";
  }
}

export function getFieldTone(field: Field, themeId: string) {
  const usesDarkSurface = field.type === "start" || themeId.endsWith("night");
  return usesDarkSurface
    ? {
        cardOverlay: "bg-gradient-to-b from-black/18 via-black/0 via-[42%] to-black/72",
        topBadge: "border border-white/14 bg-black/42 text-slate-100 shadow-[0_1px_0_rgba(255,255,255,0.06)]",
        titleText: "text-slate-50",
        metaText: "text-slate-200/90",
        footerPanel: "bg-gradient-to-t from-black/78 via-black/60 to-black/8",
        detailPanel: "border border-white/12 bg-black/58 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        detailText: "text-slate-100",
        ownerText: "text-slate-200/85",
      }
    : {
        cardOverlay: "bg-gradient-to-b from-white/10 via-transparent via-[36%] to-black/44",
        topBadge: "border border-black/10 bg-white/74 text-slate-800 shadow-[0_1px_0_rgba(255,255,255,0.4)]",
        titleText: "text-white",
        metaText: "text-white/80",
        footerPanel: "bg-gradient-to-t from-slate-950/78 via-slate-950/58 to-transparent",
        detailPanel: "border border-black/8 bg-white/88 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
        detailText: "text-slate-700",
        ownerText: "text-slate-700/75",
      };
}
