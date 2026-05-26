"use client";

interface Props {
  label: string;
  color: string;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  ariaLabel?: string;
}

export default function TouchBtn({ label, color, onPressStart, onPressEnd, ariaLabel }: Props) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      className="inline-flex items-center justify-center rounded-md font-mono font-black text-sm select-none"
      style={{
        minWidth: 44,
        minHeight: 44,
        padding: "0 10px",
        background: "rgba(8,10,20,0.96)",
        border: `1.5px solid ${color}`,
        borderBottomWidth: 3,
        color: "white",
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onPointerDown={e => { e.preventDefault(); onPressStart?.(); }}
      onPointerUp={() => onPressEnd?.()}
      onPointerCancel={() => onPressEnd?.()}
      onPointerLeave={() => onPressEnd?.()}
    >
      {label}
    </button>
  );
}
