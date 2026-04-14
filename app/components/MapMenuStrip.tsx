"use client";

import React from "react";

/**
 * MapMenuStrip — 7 svislých panelů jako hlavní menu landing page.
 *
 * Pořadí: 5 map + Ostatní mapy + Editor.
 * Hover: aktivní panel se rozšíří (flex 1→4), overlay zesvětlí, CTA vypluje.
 * Placeholder: gradient pozadí bez obrázků — připraveno pro budoucí art.
 *
 * Jak přidat reálný obrázek: doplň `bgImage` do panelu a nastav backgroundImage ve style.
 * Jak aktivovat panel: nastav available: true; navigaci řeší onPanelClick prop (nebo href jako fallback).
 */

interface Panel {
  id:        string;
  label:     string;
  emoji:     string;
  desc:      string;
  bgFrom:    string;   // Tailwind gradient top barva
  bgTo:      string;   // Tailwind gradient bottom barva
  available: boolean;
  href?:     string;   // fallback href; použije se jen pokud onPanelClick není poskytnut
}

interface MapMenuStripProps {
  /** Callback pro klik na dostupný panel — nahradí href navigaci. */
  onPanelClick?: (panelId: string) => void;
}

const PANELS: Panel[] = [
  { id: "mapa-1",  label: "Klasika",      emoji: "🏇", desc: "Základní mapa", bgFrom: "from-slate-700",   bgTo: "to-slate-900",   available: true  },
  { id: "mapa-2",  label: "Mapa 2",       emoji: "🗺️", desc: "",             bgFrom: "from-zinc-700",    bgTo: "to-zinc-950",    available: false },
  { id: "mapa-3",  label: "Mapa 3",       emoji: "🗺️", desc: "",             bgFrom: "from-stone-700",   bgTo: "to-stone-950",   available: false },
  { id: "mapa-4",  label: "Mapa 4",       emoji: "🗺️", desc: "",             bgFrom: "from-neutral-700", bgTo: "to-neutral-950", available: false },
  { id: "mapa-5",  label: "Mapa 5",       emoji: "🗺️", desc: "",             bgFrom: "from-slate-600",   bgTo: "to-slate-900",   available: false },
  { id: "ostatni", label: "Ostatní mapy", emoji: "📦", desc: "",             bgFrom: "from-slate-600",   bgTo: "to-slate-900",   available: false },
  { id: "editor",  label: "Editor",       emoji: "🛠️", desc: "",             bgFrom: "from-slate-500",   bgTo: "to-slate-800",   available: false },
];

export default function MapMenuStrip({ onPanelClick }: MapMenuStripProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  return (
    <div className="flex w-full overflow-hidden" style={{ height: "clamp(260px, 42vh, 480px)" }}>
      {PANELS.map((panel, idx) => {
        const isHovered = hovered === idx;
        // isNavigable = má kam jít (otevře setup view nebo href)
        const isNavigable = !!onPanelClick || !!panel.href;
        // isAvailable = panel je plně funkční (zobrazí "→ Hrát")
        const isAvailable = panel.available;

        const handleClick = () => {
          if (!isNavigable) return;
          if (onPanelClick) { onPanelClick(panel.id); return; }
          if (panel.href) { window.location.href = panel.href; }
        };

        const sharedProps = {
          className: [
            "group relative overflow-hidden bg-gradient-to-b",
            panel.bgFrom, panel.bgTo,
            "transition-[flex] duration-300 ease-in-out",
            isNavigable ? "cursor-pointer" : "cursor-default",
          ].join(" "),
          style: { flex: isHovered && isNavigable ? 4 : 1 },
          onMouseEnter: () => setHovered(idx),
          onMouseLeave: () => setHovered(null),
          onClick: handleClick,
        };

        const inner = (
          <>
            {/* Idle: bg-black/48 opacity-100 → hover: opacity-20 = efektivně ~10% tmavý overlay */}
            <div className={[
              "absolute inset-0 transition-opacity duration-300",
              isNavigable ? "bg-black/48 group-hover:opacity-20" : "bg-black/62",
            ].join(" ")} />

            {/* Emoji — dekorativní pozadí */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ paddingBottom: "60px" }}>
              <span className={[
                "text-7xl transition-opacity duration-300",
                isNavigable ? "opacity-20 group-hover:opacity-55" : "opacity-8",
              ].join(" ")}>
                {panel.emoji}
              </span>
            </div>

            {/* Bottom: gradient + label + desc + CTA / Brzy badge */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-8 pb-4">

              <div className={[
                "text-xs font-semibold leading-tight truncate transition-colors duration-300",
                isAvailable ? "text-white/80 group-hover:text-white" : "text-white/40 group-hover:text-white/65",
              ].join(" ")}>
                {panel.label}
              </div>

              {isAvailable && panel.desc && (
                <div className="text-xs text-white/0 leading-tight truncate mt-0.5 transition-colors duration-300 group-hover:text-white/65">
                  {panel.desc}
                </div>
              )}

              {isAvailable && (
                <div className="mt-1.5 text-xs font-semibold text-emerald-300/0 transition-colors duration-300 group-hover:text-emerald-300/90">
                  → Hrát
                </div>
              )}

              {!isAvailable && (
                <div className="mt-1.5 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400/75">
                  Brzy
                </div>
              )}
            </div>

            {/* Horní linka — vodítko pro navigovatelný panel */}
            {isNavigable && (
              <div className="absolute top-0 left-0 right-0 h-px bg-white/20" />
            )}
          </>
        );

        return (
          <div key={panel.id} role={isNavigable ? "button" : undefined} {...sharedProps}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
