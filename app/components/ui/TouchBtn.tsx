"use client";

import React from "react";

interface Props {
  label: string;
  color: string;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  ariaLabel?: string;
  /**
   * Minimální doba aktivního stavu v ms. Pokud uživatel pustí dříve, onPressEnd
   * se zpozí tak, aby ref zůstal aktivní aspoň jeden tick (doporučeno 200ms).
   */
  minHoldMs?: number;
}

export default function TouchBtn({ label, color, onPressStart, onPressEnd, ariaLabel, minHoldMs }: Props) {
  const [pressed, setPressed] = React.useState(false);
  const isDownRef = React.useRef(false);
  const pressStartRef = React.useRef(0);
  const endTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const fireEnd = React.useCallback(() => {
    endTimerRef.current = null;
    setPressed(false);
    onPressEnd?.();
  }, [onPressEnd]);

  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isDownRef.current) return; // dedup — pointer + touch fallback protection
    isDownRef.current = true;
    pressStartRef.current = Date.now();
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    // setPointerCapture: keep receiving events even if finger drifts off element
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setPressed(true);
    onPressStart?.();
  };

  const handleUp = () => {
    if (!isDownRef.current) return; // dedup
    isDownRef.current = false;
    if (minHoldMs) {
      const elapsed = Date.now() - pressStartRef.current;
      const remaining = minHoldMs - elapsed;
      if (remaining > 0) {
        // tap was shorter than minHoldMs — delay release so tick can catch it
        endTimerRef.current = setTimeout(fireEnd, remaining);
        return;
      }
    }
    fireEnd();
  };

  React.useEffect(() => () => { if (endTimerRef.current) clearTimeout(endTimerRef.current); }, []);

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      className="inline-flex items-center justify-center rounded-md font-mono font-black text-sm select-none"
      style={{
        minWidth: 48,
        minHeight: 48,
        padding: "0 12px",
        background: pressed ? `rgba(255,255,255,0.13)` : "rgba(8,10,20,0.96)",
        border: `1.5px solid ${color}`,
        borderBottomWidth: pressed ? 1 : 3,
        color: pressed ? color : "white",
        transform: pressed ? "scale(0.92)" : "scale(1)",
        transition: pressed ? "none" : "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease",
        boxShadow: pressed
          ? `0 0 12px ${color}cc, 0 0 24px ${color}66, inset 0 0 8px ${color}33`
          : `0 0 4px ${color}44`,
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {label}
    </button>
  );
}
