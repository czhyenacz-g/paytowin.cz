"use client";

import React from "react";

/**
 * MapMenuStrip — 7 vertikálních panelů jako game-mode select / hlavní menu landing page.
 *
 * Každý panel má:
 *   - accentColor: barevný identifikační proužek nahoře (CSS color string)
 *   - index: číslo slotu "01"–"07"
 *   - Hover: flex 1→4, overlay zesvětlí, accent se rozzáří
 *
 * Jak přidat reálný obrázek: doplň `bgImage` do panelu a nastav backgroundImage ve style.
 * Jak aktivovat panel: nastav available: true.
 */

interface Panel {
  id:          string;
  label:       string;
  emoji:       string;
  desc:        string;
  index:       string;       // číslo slotu "01"–"07"
  bgFrom:      string;       // Tailwind gradient — fallback pokud bgImage chybí
  bgTo:        string;
  bgImage?:    string;       // cesta k obrázku v /public (např. "/bg_horse_sun.webp")
  accentColor: string;       // CSS color — horní barevný proužek + index text
  available:   boolean;
  href?:       string;
}

interface MapMenuStripProps {
  /** Callback pro klik na panel — nahradí href navigaci. */
  onPanelClick?: (panelId: string) => void;
}

const PANELS: Panel[] = [
  { id: "mapa-1",  label: "Klasika",      emoji: "🏇", desc: "Základní mapa", index: "01", bgFrom: "from-slate-700",   bgTo: "to-slate-950",   bgImage: "/bg_horse_day.webp",    accentColor: "#f59e0b", available: true  },
  { id: "mapa-2",  label: "Mapa 2",       emoji: "🗺️", desc: "",              index: "02", bgFrom: "from-blue-900",    bgTo: "to-blue-950",    bgImage: "/bg_horse_meadow.webp", accentColor: "#60a5fa", available: false },
  { id: "mapa-3",  label: "Mapa 3",       emoji: "🗺️", desc: "",              index: "03", bgFrom: "from-emerald-900", bgTo: "to-emerald-950", bgImage: "/bg_horse_night.webp",  accentColor: "#34d399", available: false },
  { id: "mapa-4",  label: "Mapa 4",       emoji: "🗺️", desc: "",              index: "04", bgFrom: "from-red-900",     bgTo: "to-red-950",     bgImage: "/bg_car_day.webp",      accentColor: "#f87171", available: false },
  { id: "mapa-5",  label: "Mapa 5",       emoji: "🗺️", desc: "",              index: "05", bgFrom: "from-violet-900",  bgTo: "to-violet-950",  bgImage: "/bg_car_night.webp",    accentColor: "#a78bfa", available: false },
  { id: "ostatni", label: "Ostatní mapy", emoji: "📦", desc: "",              index: "06", bgFrom: "from-teal-800",    bgTo: "to-teal-950",    bgImage: "/bg_other_maps.webp",   accentColor: "#2dd4bf", available: false },
  { id: "editor",  label: "Editor",       emoji: "🛠️", desc: "",              index: "07", bgFrom: "from-orange-900",  bgTo: "to-orange-950",  bgImage: "/bg_builder_yard.webp", accentColor: "#fb923c", available: false },
];

export default function MapMenuStrip({ onPanelClick }: MapMenuStripProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  return (
    <div
      className="flex w-full overflow-hidden border-y-[3px] border-slate-800/60 shadow-2xl"
      style={{ height: "clamp(280px, 44vh, 520px)" }}
    >
      {PANELS.map((panel, idx) => {
        const isHovered = hovered === idx;
        const isLast = idx === PANELS.length - 1;
        // isNavigable = má kam jít (otevře setup view nebo href)
        const isNavigable = !!onPanelClick || !!panel.href;
        // isAvailable = panel je plně funkční
        const isAvailable = panel.available;

        const handleClick = () => {
          if (!isNavigable) return;
          if (onPanelClick) { onPanelClick(panel.id); return; }
          if (panel.href) { window.location.href = panel.href; }
        };

        return (
          <div
            key={panel.id}
            role={isNavigable ? "button" : undefined}
            className={[
              "group relative overflow-hidden bg-gradient-to-b flex-shrink-0",
              panel.bgFrom, panel.bgTo,
              "transition-[flex] duration-300 ease-in-out",
              isNavigable ? "cursor-pointer" : "cursor-default",
              !isLast ? "border-r-2 border-white/20" : "",
            ].join(" ")}
            style={{
              flex: isHovered && isNavigable ? 4 : 1,
              ...(panel.bgImage ? {
                backgroundImage: `url(${panel.bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center center",
              } : {}),
            }}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
            onClick={handleClick}
          >
            {/* ── Horní barevný accent proužek ── */}
            <div
              className="absolute top-0 left-0 right-0 h-[3px] transition-opacity duration-300 z-10"
              style={{
                background: panel.accentColor,
                opacity: isHovered ? 1 : (isAvailable ? 0.65 : 0.3),
              }}
            />

            {/* ── Diagonální textura — subtilní racing feel ── */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 14px)",
              }}
            />

            {/* ── Tmavý overlay — zesvětlí na hover ── */}
            {/* S bgImage: mírnější idle ztmavení (obrázek musí být vidět) */}
            <div
              className="absolute inset-0 transition-opacity duration-300 bg-black"
              style={{
                opacity: isHovered
                  ? 0.10
                  : (isAvailable ? 0.38 : 0.58),
              }}
            />

            {/* ── Číslo slotu (top-left) ── */}
            <div
              className="absolute top-3 left-3 text-[10px] font-black tracking-[0.2em] transition-opacity duration-300 select-none z-10"
              style={{
                color: panel.accentColor,
                opacity: isHovered ? 0.95 : 0.35,
              }}
            >
              {panel.index}
            </div>

            {/* ── Emoji — dekorativní pozadí (pouze bez bgImage) ── */}
            {!panel.bgImage && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                style={{ paddingBottom: "64px" }}
              >
                <span
                  className="text-7xl transition-opacity duration-300"
                  style={{
                    opacity: isHovered ? 0.5 : (isAvailable ? 0.18 : 0.07),
                  }}
                >
                  {panel.emoji}
                </span>
              </div>
            )}

            {/* ── Bottom: label + CTA / Brzy ── */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pt-10 pb-4 z-10">

              {/* Label */}
              <div
                className="text-sm font-bold leading-tight truncate transition-opacity duration-300 tracking-wide"
                style={{
                  color: "#fff",
                  opacity: isHovered ? 1 : (isAvailable ? 0.85 : 0.38),
                }}
              >
                {panel.label}
              </div>

              {/* Desc — jen na hover pro available */}
              {isAvailable && panel.desc && (
                <div
                  className="text-xs leading-tight truncate mt-0.5 transition-opacity duration-300 text-white/70"
                  style={{ opacity: isHovered ? 1 : 0 }}
                >
                  {panel.desc}
                </div>
              )}

              {/* CTA → Hrát — jen pro available, na hover */}
              {isAvailable && (
                <div
                  className="mt-2 transition-opacity duration-300"
                  style={{ opacity: isHovered ? 1 : 0 }}
                >
                  <span
                    className="inline-block rounded px-2 py-0.5 text-[11px] font-black tracking-widest uppercase"
                    style={{
                      background: panel.accentColor,
                      color: "#000",
                    }}
                  >
                    Hrát →
                  </span>
                </div>
              )}

              {/* Brzy badge — pro unavailable */}
              {!isAvailable && (
                <div
                  className="mt-1.5 inline-block rounded-sm px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase transition-opacity duration-300"
                  style={{
                    border: `1px solid ${panel.accentColor}55`,
                    color: panel.accentColor,
                    opacity: isHovered ? 0.9 : 0.5,
                  }}
                >
                  Brzy
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
