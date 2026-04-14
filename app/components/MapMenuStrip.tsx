"use client";

import React from "react";

/**
 * MapMenuStrip — 7 svislých panelů jako hlavní menu landing page.
 *
 * Pořadí: 5 map + Ostatní mapy + Editor.
 * Hover: aktivní panel se rozšíří (flex 2→1), overlay zesvětlí, text vypluje.
 * Placeholder: gradient pozadí bez obrázků — připraveno pro budoucí art.
 *
 * Jak přidat reálný obrázek: doplň `bgImage` do panelu a odkomentuj style.backgroundImage.
 */

interface Panel {
  id:        string;
  label:     string;
  emoji:     string;
  desc:      string;
  bgFrom:    string;  // Tailwind bg-* třída pro gradient — top barva
  bgTo:      string;  // Tailwind bg-* třída pro gradient — bottom barva
  available: boolean;
}

const PANELS: Panel[] = [
  { id: "klasika",    label: "Klasika",       emoji: "🏇", desc: "Základní mapa",      bgFrom: "from-slate-700",    bgTo: "to-slate-900",     available: true  },
  { id: "metropolis", label: "Metropolis",    emoji: "🏙️", desc: "Městská džungle",   bgFrom: "from-zinc-600",     bgTo: "to-zinc-900",      available: true  },
  { id: "divocina",   label: "Divočina",      emoji: "🌿", desc: "Lesní steeplechase", bgFrom: "from-emerald-800",  bgTo: "to-emerald-950",   available: true  },
  { id: "casino",     label: "Casino Royale", emoji: "🎰", desc: "Hazard a přepych",   bgFrom: "from-amber-800",    bgTo: "to-amber-950",     available: false },
  { id: "vesmir",     label: "Vesmír",        emoji: "🚀", desc: "Galaktické dostihy", bgFrom: "from-indigo-800",   bgTo: "to-indigo-950",    available: false },
  { id: "ostatni",    label: "Ostatní mapy",  emoji: "🗺️", desc: "Více světů",        bgFrom: "from-slate-600",    bgTo: "to-slate-800",     available: false },
  { id: "editor",     label: "Editor",        emoji: "🛠️", desc: "Vytvoř svoji mapu", bgFrom: "from-slate-500",    bgTo: "to-slate-700",     available: false },
];

export default function MapMenuStrip() {
  const [hovered, setHovered] = React.useState<number | null>(null);

  return (
    <div className="flex h-56 md:h-72 w-full overflow-hidden">
      {PANELS.map((panel, idx) => {
        const isHovered = hovered === idx;
        return (
          <div
            key={panel.id}
            className={`group relative overflow-hidden cursor-pointer bg-gradient-to-b ${panel.bgFrom} ${panel.bgTo} transition-[flex] duration-300 ease-in-out`}
            style={{ flex: isHovered ? 2 : 1 }}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Tmavý overlay — zeslábne při hoveru */}
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:opacity-0" />

            {/* Emoji jako dekorativní pozadí — sotva viditelné, zesvětlí při hoveru */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className="text-6xl opacity-10 transition-opacity duration-300 group-hover:opacity-30">
                {panel.emoji}
              </span>
            </div>

            {/* Bottom gradient + popisky */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-3">
              <div className="translate-y-1 transition-transform duration-300 group-hover:translate-y-0">
                <div className="text-white font-bold text-xs leading-tight truncate">{panel.label}</div>
                <div className="text-white/0 text-[10px] leading-tight truncate mt-0.5 transition-colors duration-300 group-hover:text-white/60">
                  {panel.desc}
                </div>
                {!panel.available && (
                  <div className="text-amber-400/0 text-[9px] font-semibold mt-0.5 transition-colors duration-300 group-hover:text-amber-400/80">
                    Brzy →
                  </div>
                )}
              </div>
            </div>

            {/* Horní jemná linka — aktivní panel */}
            {isHovered && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/20" />
            )}
          </div>
        );
      })}
    </div>
  );
}
