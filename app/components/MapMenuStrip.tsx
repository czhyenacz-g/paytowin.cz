"use client";

import React from "react";

/**
 * MapMenuStrip — 7 svislých panelů jako hlavní menu landing page.
 *
 * Pořadí: 5 map + Ostatní mapy + Editor.
 * Hover: aktivní panel se rozšíří (flex 1→2), overlay zesvětlí, text vypluje.
 * Placeholder: gradient pozadí bez obrázků — připraveno pro budoucí art.
 *
 * Jak přidat reálný obrázek: doplň `bgImage` do panelu a odkomentuj style.backgroundImage.
 * Jak aktivovat panel: nastav available: true a doplň href.
 */

interface Panel {
  id:        string;
  label:     string;
  emoji:     string;
  desc:      string;
  bgFrom:    string;   // Tailwind gradient top barva
  bgTo:      string;   // Tailwind gradient bottom barva
  available: boolean;
  href?:     string;   // cíl navigace; undefined = panel je interaktivní ale bez destinace
}

const PANELS: Panel[] = [
  { id: "klasika",    label: "Klasika",       emoji: "🏇", desc: "Základní mapa",      bgFrom: "from-slate-700",   bgTo: "to-slate-900",    available: true,  href: "#game-form" },
  { id: "metropolis", label: "Metropolis",    emoji: "🏙️", desc: "Městská džungle",   bgFrom: "from-zinc-600",    bgTo: "to-zinc-900",     available: false },
  { id: "divocina",   label: "Divočina",      emoji: "🌿", desc: "Lesní steeplechase", bgFrom: "from-emerald-800", bgTo: "to-emerald-950",  available: false },
  { id: "casino",     label: "Casino Royale", emoji: "🎰", desc: "Hazard a přepych",   bgFrom: "from-amber-800",   bgTo: "to-amber-950",    available: false },
  { id: "vesmir",     label: "Vesmír",        emoji: "🚀", desc: "Galaktické dostihy", bgFrom: "from-indigo-800",  bgTo: "to-indigo-950",   available: false },
  { id: "ostatni",    label: "Ostatní mapy",  emoji: "🗺️", desc: "Více světů",        bgFrom: "from-slate-600",   bgTo: "to-slate-800",    available: false },
  { id: "editor",     label: "Editor",        emoji: "🛠️", desc: "Vytvoř svoji mapu", bgFrom: "from-slate-500",   bgTo: "to-slate-700",    available: false },
];

export default function MapMenuStrip() {
  const [hovered, setHovered] = React.useState<number | null>(null);

  return (
    <div className="flex h-56 md:h-72 w-full overflow-hidden">
      {PANELS.map((panel, idx) => {
        const isHovered = hovered === idx;
        const isClickable = panel.available && !!panel.href;

        const sharedProps = {
          className: [
            "group relative overflow-hidden bg-gradient-to-b",
            panel.bgFrom, panel.bgTo,
            "transition-[flex] duration-300 ease-in-out",
            isClickable ? "cursor-pointer" : "cursor-default",
          ].join(" "),
          style: { flex: isHovered ? 2 : 1 },
          onMouseEnter: () => setHovered(idx),
          onMouseLeave: () => setHovered(null),
        };

        const inner = (
          <>
            {/* Tmavý overlay — zeslábne při hoveru dostupného panelu */}
            <div className={[
              "absolute inset-0 transition-opacity duration-300",
              isClickable ? "bg-black/40 group-hover:opacity-0" : "bg-black/55",
            ].join(" ")} />

            {/* Emoji jako dekorativní pozadí */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className={[
                "text-6xl transition-opacity duration-300",
                isClickable ? "opacity-10 group-hover:opacity-30" : "opacity-5",
              ].join(" ")}>
                {panel.emoji}
              </span>
            </div>

            {/* Bottom gradient + popisky */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-3">
              <div className={[
                "transition-transform duration-300",
                isClickable ? "translate-y-1 group-hover:translate-y-0" : "",
              ].join(" ")}>
                <div className={[
                  "font-bold text-xs leading-tight truncate",
                  isClickable ? "text-white" : "text-white/50",
                ].join(" ")}>{panel.label}</div>
                <div className={[
                  "text-[10px] leading-tight truncate mt-0.5 transition-colors duration-300",
                  isClickable ? "text-white/0 group-hover:text-white/60" : "text-white/0",
                ].join(" ")}>{panel.desc}</div>
                {!panel.available && (
                  <div className="text-amber-400/0 text-[9px] font-semibold mt-0.5 transition-colors duration-300 group-hover:text-amber-400/70">
                    Brzy →
                  </div>
                )}
              </div>
            </div>

            {/* Horní linka — jen na aktivním dostupném panelu */}
            {isHovered && isClickable && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/20" />
            )}
          </>
        );

        if (isClickable) {
          return (
            <a key={panel.id} href={panel.href} {...sharedProps}>
              {inner}
            </a>
          );
        }

        return (
          <div key={panel.id} {...sharedProps}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
