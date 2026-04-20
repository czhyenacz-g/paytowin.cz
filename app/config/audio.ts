import type { MusicSource } from "@/lib/audio/music";

/**
 * MENU_MUSIC — background music pro hlavní menu (MapMenuStrip).
 *
 * Jak aktivovat: nahraď undefined objektem { src: "..." }
 *
 * Příklady:
 *   export const MENU_MUSIC: MusicSource = { src: "/audio/menu-theme.mp3" };
 *   export const MENU_MUSIC: MusicSource = { src: "https://cdn.example.com/menu.mp3" };
 */
export const MENU_MUSIC: MusicSource | undefined = undefined;
