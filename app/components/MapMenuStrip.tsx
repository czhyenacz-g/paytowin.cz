"use client";

import React from "react";
import { getRequiredXpForPanel, isUnlockedByXp, formatUnlockMessage } from "@/lib/map-unlocks";

/**
 * MapMenuStrip — game-mode select / hlavní menu landing page.
 *
 * Desktop (≥ sm / 640 px): vodorovný accordion, hover expand flex 1→4.
 * Mobil (< sm): samostatný vertikální seznam řádků pod sebou.
 *
 * Sdílená data: PANELS[], LIVE_UNLOCKED_ACCESS, hasMenuAccess().
 * Každý panel má accentColor, requiredAccess, bgImage, available flag.
 */

interface Panel {
  id:          string;
  label:       string;
  emoji:       string;
  desc:        string;
  index:       string;
  bgFrom:      string;
  bgTo:        string;
  bgImage?:    string;
  accentColor: string;
  available:   boolean;
  idleOverlayOpacity?: number;
  bgPosition?: string;
  href?:       string;
  requiredAccess?: string;
  location?:   string;
  chapterOf?:  string;
}

interface MapMenuStripProps {
  /** Callback pro klik na odemčený panel. */
  onPanelClick?: (panelId: string) => void;
  /** Aktuální XP hráče — null pokud přihlášen ale ještě se načítá, undefined pokud nepřihlášen. */
  currentXp?: number | null;
  /** True pokud je hráč přihlášen přes Discord. */
  isLoggedIn?: boolean;
}

/** Vrátí true pokud je panel XP-odemčený (nebo je to dev/bez XP požadavku). */
function isPanelXpUnlocked(panelId: string, currentXp: number | null | undefined, isDev: boolean): boolean {
  if (isDev) return true;
  const required = getRequiredXpForPanel(panelId);
  if (required === 0) return true;
  if (currentXp == null) return false;
  return isUnlockedByXp(currentXp, required);
}

const PANELS: Panel[] = [
  { id: "mapa-1",  label: "Denní dostihy",  emoji: "🏇",  desc: "Banka udělala chybu. Ty z ní chceš udělat titulní příběh.",   index: "01", bgFrom: "from-slate-700",   bgTo: "to-slate-950",   bgImage: "/bg_horse_day.webp",     accentColor: "#f59e0b", available: true,  requiredAccess: "theme_horse_day",     location: "USA · 1921",          chapterOf: "paytowin" },
  { id: "mapa-2",  label: "Noční dostihy",  emoji: "🌙",  desc: "Přes den se závodí pro slávu. V noci pro přežití.",           index: "02", bgFrom: "from-emerald-900", bgTo: "to-emerald-950", bgImage: "/bg_horse_night.webp",    accentColor: "#34d399", available: true,  requiredAccess: "theme_horse_night",   location: "USA · 1925",          chapterOf: "paytowin" },
  { id: "mapa-3",  label: "Chuchle 1930",   emoji: "🏇",  desc: "Po krizi začínáš znovu tam, kde mají dostihy české kořeny.", index: "03", bgFrom: "from-blue-900",    bgTo: "to-blue-950",    bgImage: "/bg_horse_classic.webp",  accentColor: "#60a5fa", available: true,  requiredAccess: "theme_horse_classic", location: "Chuchle · 1930",      chapterOf: "paytowin" },
  { id: "mapa-4",  label: "Denní auta",     emoji: "🏎️", desc: "Koně ustupují. Motory přebírají budoucnost.",                 index: "04", bgFrom: "from-red-900",     bgTo: "to-red-950",     bgImage: "/bg_car_day.webp",        accentColor: "#f87171", available: true,  requiredAccess: "theme_car_day",       location: "Evropa · 1934",       chapterOf: "paytowin" },
  { id: "mapa-5",  label: "Noční auta",     emoji: "🌃",  desc: "Po setmění už nejde jen o rychlost.",                         index: "05", bgFrom: "from-violet-900",  bgTo: "to-violet-950",  bgImage: "/bg_car_night.webp",      accentColor: "#a78bfa", available: true,  requiredAccess: "theme_car_night",     location: "Noční město · 1936",  chapterOf: "paytowin" },
  { id: "ostatni", label: "Komunitní mapy", emoji: "📦",  desc: "Další tratě od komunity",                                    index: "06", bgFrom: "from-teal-800",    bgTo: "to-teal-950",    bgImage: "/bg_other_maps.webp",     accentColor: "#2dd4bf", available: true,  requiredAccess: "community_maps"      },
  { id: "editor",  label: "Editor",         emoji: "🛠️", desc: "Postav vlastní trať",                                        index: "07", bgFrom: "from-orange-900",  bgTo: "to-orange-950",  bgImage: "/bg_builder_yard.webp",   accentColor: "#fb923c", available: true,  requiredAccess: "editor"              },
  { id: "profil",  label: "Tvůj profil",    emoji: "🛡️", desc: "Statistiky, odměny a reputace",                             index: "08", bgFrom: "from-slate-500",   bgTo: "to-slate-800",   bgImage: "/bg_dark_racer.webp",     accentColor: "#f8fafc", available: true,  requiredAccess: "profile", idleOverlayOpacity: 0.22, bgPosition: "42% 18%" },
];

export default function MapMenuStrip({ onPanelClick, currentXp, isLoggedIn = false }: MapMenuStripProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [isDev, setIsDev] = React.useState(process.env.NODE_ENV === "development");
  const [selectedId, setSelectedId] = React.useState<string>(PANELS[0].id);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [lockToastMessage, setLockToastMessage] = React.useState<string | null>(null);
  const lockToastTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") setIsDev(true);
  }, []);

  React.useEffect(() => {
    return () => {
      if (lockToastTimerRef.current) {
        window.clearTimeout(lockToastTimerRef.current);
      }
    };
  }, []);

  const showLockToast = React.useCallback((message: string) => {
    setLockToastMessage(message);
    if (lockToastTimerRef.current) {
      window.clearTimeout(lockToastTimerRef.current);
    }
    lockToastTimerRef.current = window.setTimeout(() => {
      setLockToastMessage(null);
      lockToastTimerRef.current = null;
    }, 10000);
  }, []);

  const dismissLockToast = React.useCallback(() => {
    if (lockToastTimerRef.current) {
      window.clearTimeout(lockToastTimerRef.current);
      lockToastTimerRef.current = null;
    }
    setLockToastMessage(null);
  }, []);

  // ── Hover zvuk (desktop only) ─────────────────────────────────────────────
  const audioCtxRef    = React.useRef<AudioContext | null>(null);
  const lastSoundMsRef = React.useRef<number>(0);

  const playHoverSound = React.useCallback(() => {
    const now = Date.now();
    if (now - lastSoundMsRef.current < 70) return;
    lastSoundMsRef.current = now;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const play = () => {
        const t = ctx.currentTime;
        const dur = 0.13;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(680, t + dur);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.10, t + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
      };
      if (ctx.state === "suspended") { ctx.resume().then(play).catch(() => {}); } else { play(); }
    } catch { /* AudioContext nedostupný */ }
  }, []);

  return (
    <>
      {/* Campaign header */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5 px-0.5">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400/85 select-none">První kampaň · PayToWin.cz</span>
        <span className="text-[9px] text-amber-200/35 tracking-wider select-none">5 kapitol · 1921–1936 · od dostihů ke strojům</span>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE render — zobrazí se jen na < sm (< 640 px)
          Dropdown: zavřený = vybraná mapa jako card; otevřený = seznam všech map.
          ════════════════════════════════════════════════════════════════════ */}
      <div className="sm:hidden w-full shadow-2xl rounded-sm overflow-hidden">
        {/* Zavřený stav — vybraná mapa */}
        {(() => {
          const sel = PANELS.find(p => p.id === selectedId) ?? PANELS[0];
          return (
            <div
              role="button"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen(o => !o)}
              className="relative flex items-center gap-3 px-4 min-h-[88px] overflow-hidden cursor-pointer active:brightness-75"
              style={sel.bgImage ? {
                backgroundImage: `url(${sel.bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: sel.bgPosition ?? "center",
              } : undefined}
            >
              {/* Gradient overlay — silnější pro čitelnost textu */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40 pointer-events-none" />

              {/* Levý accent proužek */}
              <div className="relative z-10 self-stretch w-[3px] shrink-0 my-3 rounded-full" style={{ background: sel.accentColor }} />

              {/* Obsah */}
              <div className="relative z-10 flex-1 min-w-0 py-3">
                <div className="text-[8px] font-black uppercase tracking-[0.2em] mb-0.5" style={{ color: sel.accentColor, opacity: 0.85 }}>Vybraná mapa</div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base leading-none shrink-0">{sel.emoji}</span>
                  <span className="text-sm font-bold text-white truncate">{sel.label}</span>
                </div>
                {sel.location && (
                  <p className="mt-0.5 text-[9px] tracking-wide text-white/75 truncate">{sel.location}</p>
                )}
                {sel.desc && (
                  <p className="mt-0.5 text-[11px] leading-tight text-white/50 truncate">{sel.desc}</p>
                )}
              </div>

              {/* Chevron */}
              <div className="relative z-10 shrink-0 flex flex-col items-center justify-center w-8">
                <span
                  className="text-white/50 text-lg leading-none transition-transform duration-200"
                  style={{ transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  ⌄
                </span>
              </div>
            </div>
          );
        })()}

        {/* Rozbalený seznam */}
        {dropdownOpen && (
          <div className="flex flex-col divide-y divide-black/40 border-t border-black/50">
            {PANELS.map((panel) => {
              const isLocked = !isPanelXpUnlocked(panel.id, currentXp, isDev);
              const isNavigable = !!onPanelClick || !!panel.href;
              const isAvailable = panel.available;
              const isSelected = panel.id === selectedId;

              const handleClick = () => {
                if (isLocked) {
                  const msg = formatUnlockMessage(panel.id, getRequiredXpForPanel(panel.id), currentXp ?? null, isLoggedIn);
                  showLockToast(msg);
                  return;
                }
                dismissLockToast();
                setSelectedId(panel.id);
                setDropdownOpen(false);
                if (!isNavigable) return;
                if (onPanelClick) { onPanelClick(panel.id); return; }
                if (panel.href) window.location.href = panel.href;
              };

              return (
                <React.Fragment key={panel.id}>
                  {panel.id === "ostatni" && (
                    <div className="bg-black/60 px-4 py-1 text-[8px] font-black uppercase tracking-[0.25em] text-white/25 select-none pointer-events-none">Ostatní sekce</div>
                  )}
                  <div
                    role="button"
                    onClick={handleClick}
                    className={[
                      "relative flex items-center gap-3 px-4 min-h-[62px] overflow-hidden",
                      panel.bgFrom, "bg-gradient-to-b", panel.bgTo,
                      isLocked ? "cursor-pointer" : (isNavigable ? "cursor-pointer active:brightness-75" : "cursor-default"),
                      isSelected ? "ring-1 ring-inset" : "",
                    ].join(" ")}
                    style={{
                      ...(panel.bgImage ? {
                        backgroundImage: `url(${panel.bgImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: panel.bgPosition ?? "center",
                      } : {}),
                      ...(isSelected ? { boxShadow: `inset 0 0 0 1px ${panel.accentColor}55` } : {}),
                    }}
                  >
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/62 pointer-events-none" />

                    {/* Accent proužek */}
                    <div className="relative z-10 self-stretch w-[3px] shrink-0 my-3 rounded-full" style={{ background: panel.accentColor }} />

                    {/* Obsah */}
                    <div className="relative z-10 flex-1 min-w-0 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none shrink-0">{panel.emoji}</span>
                        <span className="text-sm font-bold text-white truncate">{panel.label}</span>
                        {isSelected && (
                          <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: panel.accentColor + "33", color: panel.accentColor }}>✓</span>
                        )}
                      </div>
                      {panel.location && (
                        <p className="mt-0 text-[9px] tracking-wide text-white/65 truncate">{panel.location}</p>
                      )}
                    </div>

                    {/* Zámek / šipka */}
                    {isLocked ? (
                      <span className="relative z-10 shrink-0 text-sm select-none">🔒</span>
                    ) : (isNavigable && isAvailable && !isSelected) ? (
                      <span className="relative z-10 shrink-0 text-white/30 text-xl leading-none">›</span>
                    ) : null}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP render — zobrazí se jen na ≥ sm (≥ 640 px)
          Původní vodorovný accordion s hover expand efektem.
          ════════════════════════════════════════════════════════════════════ */}
      <div
        className="hidden sm:flex w-full overflow-hidden shadow-2xl"
        style={{
          height: "clamp(280px, 44vh, 520px)",
          borderTop: "4px solid rgba(0,0,0,0.75)",
          borderBottom: "4px solid rgba(0,0,0,0.75)",
        }}
      >
        {PANELS.map((panel, idx) => {
          const isHovered = hovered === idx;
          const isLast = idx === PANELS.length - 1;
          const isLocked = !isPanelXpUnlocked(panel.id, currentXp, isDev);
          const isNavigable = !!onPanelClick || !!panel.href;
          const isAvailable = panel.available;

          const handleClick = () => {
            if (isLocked) {
              const msg = formatUnlockMessage(panel.id, getRequiredXpForPanel(panel.id), currentXp ?? null, isLoggedIn);
              showLockToast(msg);
              return;
            }
            dismissLockToast();
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
                "transition-[flex,box-shadow,filter] duration-300 ease-in-out",
                isLocked
                  ? "cursor-not-allowed"
                  : (isNavigable ? "cursor-pointer ring-2 ring-inset ring-amber-300/40 shadow-[inset_0_0_0_1px_rgba(253,224,71,0.16),0_0_0_1px_rgba(0,0,0,0.20)] hover:ring-amber-200/70 hover:shadow-[inset_0_0_0_1px_rgba(253,224,71,0.28),0_0_0_1px_rgba(0,0,0,0.30),0_0_26px_rgba(245,158,11,0.18)]" : "cursor-default"),
              ].join(" ")}
              style={{
                flex: isHovered && isNavigable ? (isLocked ? 2 : 4) : 1,
                boxShadow: !isLast
                  ? "inset -1px 0 0 rgba(255,255,255,0.18), inset -4px 0 0 rgba(0,0,0,0.80)"
                  : "none",
                ...(panel.bgImage ? {
                  backgroundImage: `url(${panel.bgImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: panel.bgPosition ?? "center center",
                } : {}),
              }}
              onMouseEnter={() => { setHovered(idx); playHoverSound(); }}
              onMouseLeave={() => setHovered(null)}
              onClick={handleClick}
            >
              {/* Horní barevný accent proužek */}
              <div
                className="absolute top-0 left-0 right-0 h-[3px] transition-opacity duration-300 z-10"
                style={{ background: panel.accentColor, opacity: isHovered ? 1 : (isAvailable ? 0.95 : 0.34), boxShadow: isAvailable ? "0 0 22px rgba(245,158,11,0.28)" : undefined }}
              />

              {/* Diagonální textura */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 14px)" }}
              />

              {/* Tmavý overlay */}
              <div
                className="absolute inset-0 transition-opacity duration-300 bg-black"
                style={{ opacity: isHovered ? (isLocked ? 0.25 : 0.10) : (isAvailable ? (panel.idleOverlayOpacity ?? 0.38) : 0.58) }}
              />

              {/* ZAMKNUTO overlay */}
              {isLocked && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-black/40 pb-[20%] pointer-events-none select-none">
                  <span style={{ fontSize: "22px", lineHeight: 1 }}>🔒</span>
                  <span className="rounded-full border border-amber-300/35 bg-black/70 px-2.5 py-0.5 text-[10px] font-black tracking-[0.18em] uppercase text-amber-100 shadow-sm">Zamčeno</span>
                  <span className="text-[8px] tracking-wide text-amber-100/70 text-center leading-tight px-1">Vyžaduje odemknutí</span>
                </div>
              )}

              {/* Číslo slotu */}
              <div
                className="absolute top-3 left-3 text-[10px] font-black tracking-[0.2em] transition-opacity duration-300 select-none z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                style={{ color: isAvailable ? "#fde68a" : panel.accentColor, opacity: isHovered ? 1 : (isAvailable ? 0.92 : 0.58) }}
              >
                {panel.index}
              </div>

              {panel.location && (
                <div
                  className="absolute top-[22px] left-3 text-[7px] tracking-[0.12em] uppercase select-none z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                  style={{ color: "#f5f0e8", opacity: isHovered ? 0.90 : 0.72 }}
                >
                  {panel.location}
                </div>
              )}

              {/* Emoji — dekorativní (bez bgImage) */}
              {!panel.bgImage && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ paddingBottom: "64px" }}>
                  <span className="text-7xl transition-opacity duration-300 drop-shadow-[0_8px_24px_rgba(0,0,0,0.22)]" style={{ opacity: isHovered ? 0.56 : (isAvailable ? 0.24 : 0.08) }}>
                    {panel.emoji}
                  </span>
                </div>
              )}

              {/* Bottom: label + CTA / Brzy */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pt-10 pb-4 z-10">
                <div
                  className="text-sm font-bold leading-tight truncate transition-opacity duration-300 tracking-wide text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  style={{ opacity: isHovered ? 1 : (isAvailable ? 0.98 : 0.56) }}
                >
                  {panel.label}
                </div>

                {isAvailable && panel.desc && (
                  <div
                    className="text-xs leading-tight truncate mt-0.5 transition-opacity duration-300 text-amber-50/72"
                    style={{ opacity: isHovered ? 1 : (isAvailable ? 0.92 : 0) }}
                  >
                    {panel.desc}
                  </div>
                )}

                {isAvailable && (
                  <div className="mt-2 transition-opacity duration-300" style={{ opacity: isHovered ? 1 : 0.95 }}>
                    <span
                      className="inline-block rounded px-2 py-0.5 text-[11px] font-black tracking-widest uppercase whitespace-nowrap shadow-[0_2px_6px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-amber-100/30"
                      style={{ background: "linear-gradient(180deg, rgba(255,237,160,0.98), rgba(245,158,11,0.92))", color: "#1f1300" }}
                    >
                      {panel.id === "profil" ? "Otevřít →" : panel.id === "editor" ? "Jít budovat →" : "Hrát →"}
                    </span>
                  </div>
                )}

                {!isAvailable && (
                  <div
                    className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-widest uppercase transition-opacity duration-300 bg-black/70 backdrop-blur-sm shadow-sm"
                    style={{ border: "1px solid rgba(253,224,71,0.34)", color: "#fde68a", opacity: isHovered ? 1 : 0.92 }}
                  >
                    Zamčeno
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lockToastMessage && (
        <div
          className="fixed left-1/2 top-4 z-[80] w-[calc(100vw-2rem)] max-w-[34rem] -translate-x-1/2 rounded-2xl border border-amber-300/30 bg-slate-950/92 px-4 py-3 text-sm text-amber-100 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-md sm:left-auto sm:right-4 sm:top-5 sm:translate-x-0"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-base">🔒</span>
            <p className="min-w-0 flex-1 leading-relaxed text-amber-50/95">
              {lockToastMessage}
            </p>
            <button
              type="button"
              onClick={dismissLockToast}
              className="shrink-0 rounded-full px-2 py-0.5 text-base leading-none text-amber-100/70 transition hover:bg-amber-100/10 hover:text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              aria-label="Zavřít upozornění"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
