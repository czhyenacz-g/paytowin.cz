"use client";

import React from "react";

/**
 * MapMenuStrip — 7 svislých panelů jako hlavní menu landing page.
 *
 * Pořadí: 5 map + Ostatní mapy + Editor.
 * Hover: aktivní panel se rozšíří (flex 1→2.5), overlay zesvětlí, CTA vypluje.
 * Placeholder: gradient pozadí bez obrázků — připraveno pro budoucí art.
 *
 * Jak přidat reálný obrázek: doplň `bgImage` do panelu a nastav backgroundImage ve style.
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
  href?:     string;   // cíl navigace; undefined = panel bez destinace
}

const PANELS: Panel[] = [
  { id: "mapa-1",  label: "Klasika",      emoji: "🏇", desc: "Základní mapa", bgFrom: "from-slate-700",   bgTo: "to-slate-900",   available: true,  href: "#game-form" },
  { id: "mapa-2",  label: "Mapa 2",       emoji: "🗺️", desc: "",             bgFrom: "from-zinc-700",    bgTo: "to-zinc-950",    available: false },
  { id: "mapa-3",  label: "Mapa 3",       emoji: "🗺️", desc: "",             bgFrom: "from-stone-700",   bgTo: "to-stone-950",   available: false },
  { id: "mapa-4",  label: "Mapa 4",       emoji: "🗺️", desc: "",             bgFrom: "from-neutral-700", bgTo: "to-neutral-950", available: false },
  { id: "mapa-5",  label: "Mapa 5",       emoji: "🗺️", desc: "",             bgFrom: "from-slate-600",   bgTo: "to-slate-900",   available: false },
  { id: "ostatni", label: "Ostatní mapy", emoji: "📦", desc: "",             bgFrom: "from-slate-600",   bgTo: "to-slate-900",   available: false },
  { id: "editor",  label: "Editor",       emoji: "🛠️", desc: "",             bgFrom: "from-slate-500",   bgTo: "to-slate-800",   available: false },
];

export default function MapMenuStrip() {
  const [hovered, setHovered] = React.useState<number | null>(null);

  return (
    <div className="flex w-full overflow-hidden" style={{ height: "clamp(320px, 50vh, 580px)" }}>
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
          style: { flex: isHovered && isClickable ? 2.5 : 1 },
          onMouseEnter: () => setHovered(idx),
          onMouseLeave: () => setHovered(null),
        };

        const inner = (
          <>
            {/* Overlay — dostupný panel zesvětlí na hover, nedostupný zůstane tmavý */}
            <div className={[
              "absolute inset-0 transition-opacity duration-300",
              isClickable ? "bg-black/35 group-hover:opacity-0" : "bg-black/65",
            ].join(" ")} />

            {/* Emoji — dekorativní, výrazně větší, lépe čitelné na velkém panelu */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ paddingBottom: "60px" }}>
              <span className={[
                "text-7xl transition-opacity duration-300",
                isClickable ? "opacity-20 group-hover:opacity-50" : "opacity-5",
              ].join(" ")}>
                {panel.emoji}
              </span>
            </div>

            {/* Bottom: gradient + label + desc + CTA / Brzy badge */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-8 pb-4">

              {/* Název */}
              <div className={[
                "text-sm font-bold leading-tight truncate",
                isClickable ? "text-white" : "text-white/35",
              ].join(" ")}>
                {panel.label}
              </div>

              {/* Popis — jen u dostupného, rozkryje se na hover */}
              {isClickable && panel.desc && (
                <div className="text-xs text-white/0 leading-tight truncate mt-0.5 transition-colors duration-300 group-hover:text-white/65">
                  {panel.desc}
                </div>
              )}

              {/* CTA — dostupný panel, objeví se na hover */}
              {isClickable && (
                <div className="mt-1.5 text-xs font-semibold text-emerald-300/0 transition-colors duration-300 group-hover:text-emerald-300/90">
                  → Hrát
                </div>
              )}

              {/* Brzy pill — nedostupný panel, vždy viditelný */}
              {!panel.available && (
                <div className="mt-1.5 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400/55">
                  Brzy
                </div>
              )}
            </div>

            {/* Horní linka — dostupný panel, vždy viditelná jako vodítko */}
            {isClickable && (
              <div className="absolute top-0 left-0 right-0 h-px bg-white/20" />
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
