"use client";

import React from "react";

export interface TelegramMessage {
  text: string;
  morse: string;
}

interface Props {
  message: TelegramMessage | null;
}

/**
 * TelegramStrip — horizontální proužek ve stylu dobového telegrafu.
 *
 * Řádek 1: morseovka (technický / menší)
 * Řádek 2: normální text (čitelný / důležitý)
 *
 * Auto-hide je řízen rodičem — komponenta se renderuje jen pokud message !== null.
 */
export default function TelegramStrip({ message }: Props) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!message) { setVisible(false); return; }
    // Krátký delay pro mount → trigger CSS transition
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-2"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-12px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-b-xl shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #1a0e00 0%, #2d1a00 60%, #1a0e00 100%)",
          border: "1px solid rgba(180,130,40,0.45)",
          borderTop: "none",
        }}
      >
        {/* Horní dekorativní linka */}
        <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, transparent, #b4822a, transparent)" }} />

        <div className="px-4 py-2.5">
          {/* Hlavička */}
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "#b4822a" }}>
              ◆ TELEGRAM ◆
            </span>
            <div className="h-px flex-1" style={{ background: "rgba(180,130,40,0.3)" }} />
          </div>

          {/* Řádek 1: morseovka */}
          <p
            className="mb-1 font-mono leading-snug tracking-widest"
            style={{ fontSize: "10px", color: "rgba(180,130,40,0.75)", letterSpacing: "0.12em" }}
          >
            {message.morse}
          </p>

          {/* Řádek 2: normální text */}
          <p
            className="font-semibold uppercase tracking-wider"
            style={{ fontSize: "13px", color: "#f5e6c0", letterSpacing: "0.08em" }}
          >
            {message.text}
          </p>
        </div>

        {/* Spodní dekorativní linka */}
        <div className="h-[1px] w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(180,130,40,0.3), transparent)" }} />
      </div>
    </div>
  );
}
