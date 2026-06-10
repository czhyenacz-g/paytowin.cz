"use client";

import React from "react";

interface Props {
  label: string;
  color: string;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  ariaLabel?: string;
  /**
   * Min ms pro vizuální pressed stav (feedback pro uživatele). Default: žádný min.
   */
  feedbackMs?: number;
  /**
   * Min ms před voláním onPressEnd (jak dlouho je input aktivní).
   * Pro směrová tlačítka: nastavit < tick period (156ms) aby se zabránilo multi-tick zatočení.
   * Pro BOOST: může být delší (spolehlivé zachycení).
   */
  inputHoldMs?: number;
}

export default function TouchBtn({ label, color, onPressStart, onPressEnd, ariaLabel, feedbackMs, inputHoldMs }: Props) {
  const [pressed, setPressed] = React.useState(false);
  const isDownRef = React.useRef(false);
  const pressStartRef = React.useRef(0);
  const inputEndTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackEndTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (inputEndTimerRef.current) { clearTimeout(inputEndTimerRef.current); inputEndTimerRef.current = null; }
    if (feedbackEndTimerRef.current) { clearTimeout(feedbackEndTimerRef.current); feedbackEndTimerRef.current = null; }
  };

  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isDownRef.current) return;
    isDownRef.current = true;
    pressStartRef.current = Date.now();
    clearTimers();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setPressed(true);
    onPressStart?.();
  };

  const handleUp = () => {
    if (!isDownRef.current) return;
    isDownRef.current = false;
    const elapsed = Date.now() - pressStartRef.current;

    // Naplánuj onPressEnd po inputHoldMs (nebo ihned pokud uživatel držel dost dlouho)
    const inputDelay = Math.max(0, (inputHoldMs ?? 0) - elapsed);
    if (inputDelay > 0) {
      inputEndTimerRef.current = setTimeout(() => {
        inputEndTimerRef.current = null;
        onPressEnd?.();
      }, inputDelay);
    } else {
      onPressEnd?.();
    }

    // Naplánuj vizuální clear po feedbackMs (nezávislé na inputu)
    const feedbackDelay = Math.max(0, (feedbackMs ?? 0) - elapsed);
    if (feedbackDelay > 0) {
      feedbackEndTimerRef.current = setTimeout(() => {
        feedbackEndTimerRef.current = null;
        setPressed(false);
      }, feedbackDelay);
    } else {
      setPressed(false);
    }
  };

  React.useEffect(() => () => clearTimers(), []);

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
        WebkitTouchCallout: "none",
      }}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {label}
    </button>
  );
}
