import type { PlayerMarker } from "@/lib/playerMarkers";

export default function PlayerStateMarkers({ markers }: { markers: PlayerMarker[] }) {
  if (markers.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {markers.map((m) => (
        <span key={m.emoji} title={m.title} className="text-sm leading-none select-none cursor-help">
          {m.emoji}
        </span>
      ))}
    </span>
  );
}
