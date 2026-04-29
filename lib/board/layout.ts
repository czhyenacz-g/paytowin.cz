import type { CSSProperties } from "react";
import { STADIUM_ASPECT } from "@/lib/board/constants";

export const FIELD_POSITIONS: CSSProperties[] = [
  { top: "50.0%", left: "8.0%",  transform: "translate(-50%, -50%)" },  //  0 START
  { top: "37.7%", left: "9.8%",  transform: "translate(-50%, -50%)" },  //  1
  { top: "26.4%", left: "15.3%", transform: "translate(-50%, -50%)" },  //  2
  { top: "17.2%", left: "23.7%", transform: "translate(-50%, -50%)" },  //  3
  { top: "10.9%", left: "34.8%", transform: "translate(-50%, -50%)" },  //  4
  { top: "8.1%",  left: "46.9%", transform: "translate(-50%, -50%)" },  //  5
  { top: "9.1%",  left: "59.4%", transform: "translate(-50%, -50%)" },  //  6
  { top: "13.6%", left: "71.0%", transform: "translate(-50%, -50%)" },  //  7
  { top: "21.4%", left: "80.8%", transform: "translate(-50%, -50%)" },  //  8
  { top: "31.8%", left: "87.8%", transform: "translate(-50%, -50%)" },  //  9
  { top: "43.8%", left: "91.5%", transform: "translate(-50%, -50%)" },  // 10
  { top: "56.2%", left: "91.5%", transform: "translate(-50%, -50%)" },  // 11
  { top: "68.2%", left: "87.8%", transform: "translate(-50%, -50%)" },  // 12
  { top: "78.6%", left: "80.8%", transform: "translate(-50%, -50%)" },  // 13
  { top: "86.4%", left: "71.0%", transform: "translate(-50%, -50%)" },  // 14
  { top: "91.0%", left: "59.4%", transform: "translate(-50%, -50%)" },  // 15
  { top: "91.9%", left: "46.9%", transform: "translate(-50%, -50%)" },  // 16
  { top: "89.1%", left: "34.8%", transform: "translate(-50%, -50%)" },  // 17
  { top: "82.8%", left: "23.7%", transform: "translate(-50%, -50%)" },  // 18
  { top: "73.7%", left: "15.3%", transform: "translate(-50%, -50%)" },  // 19
  { top: "62.3%", left: "9.8%",  transform: "translate(-50%, -50%)" },  // 20
];

// ─── Stadium layout — 21 pozic na stadionovém okruhu ─────────────────────────
// Geometrie: r=22 (poloměr zaoblení), hw=18 (polovina délky rovné strany), střed 50/50.
// Perimetr ≈ 210.23, krok = 210.23/21 ≈ 10.01. Počátek: levý krajní bod (10, 50).
// Traversal: CCW v matematickém prostoru = CW na obrazovce (CSS y dolů).
export const FIELD_POSITIONS_STADIUM: CSSProperties[] = [
  { top: "50.00%", left: "10.00%", transform: "translate(-50%, -50%)" },  //  0 START  (levý krajní bod)
  { top: "40.37%", left: "12.23%", transform: "translate(-50%, -50%)" },  //  1
  { top: "32.61%", left: "18.54%", transform: "translate(-50%, -50%)" },  //  2
  { top: "28.45%", left: "27.59%", transform: "translate(-50%, -50%)" },  //  3
  { top: "28.00%", left: "37.48%", transform: "translate(-50%, -50%)" },  //  4  (začátek horní roviny)
  { top: "28.00%", left: "47.50%", transform: "translate(-50%, -50%)" },  //  5
  { top: "28.00%", left: "57.51%", transform: "translate(-50%, -50%)" },  //  6
  { top: "28.00%", left: "67.52%", transform: "translate(-50%, -50%)" },  //  7  (konec horní roviny)
  { top: "30.04%", left: "77.27%", transform: "translate(-50%, -50%)" },  //  8  (pravý oblouk)
  { top: "36.13%", left: "85.08%", transform: "translate(-50%, -50%)" },  //  9
  { top: "45.05%", left: "89.42%", transform: "translate(-50%, -50%)" },  // 10
  { top: "54.97%", left: "89.42%", transform: "translate(-50%, -50%)" },  // 11
  { top: "63.88%", left: "85.07%", transform: "translate(-50%, -50%)" },  // 12
  { top: "69.97%", left: "77.25%", transform: "translate(-50%, -50%)" },  // 13
  { top: "72.00%", left: "67.51%", transform: "translate(-50%, -50%)" },  // 14  (začátek dolní roviny)
  { top: "72.00%", left: "57.51%", transform: "translate(-50%, -50%)" },  // 15
  { top: "72.00%", left: "47.50%", transform: "translate(-50%, -50%)" },  // 16
  { top: "72.00%", left: "37.48%", transform: "translate(-50%, -50%)" },  // 17  (konec dolní roviny)
  { top: "71.55%", left: "27.56%", transform: "translate(-50%, -50%)" },  // 18  (levý oblouk dolní)
  { top: "67.38%", left: "18.51%", transform: "translate(-50%, -50%)" },  // 19
  { top: "59.63%", left: "12.23%", transform: "translate(-50%, -50%)" },  // 20
];

// Rotace polí pro stadium layout — tangenciální úhel na každém bodě tratě (stupně).
// Vypočteno jako: rotDeg = 90 − α, kde α je outward normal úhel v matematické konvenci.
export const FIELD_ROTATIONS_STADIUM: number[] = [
  -90,   //  0  (levý krajní bod, outward = vlevo 180°)
  -64,   //  1
  -38,   //  2
  -12,   //  3
    0,   //  4  (horní rovina, outward = nahoru 90°)
    0,   //  5
    0,   //  6
    0,   //  7
   25,   //  8  (pravý oblouk)
   51,   //  9
   77,   // 10
  103,   // 11
  129,   // 12
  155,   // 13
  180,   // 14  (dolní rovina, outward = dolů −90°)
  180,   // 15
  180,   // 16
  180,   // 17
  192,   // 18  (levý oblouk dolní)
  218,   // 19
  244,   // 20
];

// Pozice figurek — každé pole posunuté o ~10 % směrem ke středu desky (50 %, 50 %)
export const FIGURINE_POSITIONS: CSSProperties[] = FIELD_POSITIONS.map((pos) => {
  const left = parseFloat(pos.left as string);
  const top  = parseFloat(pos.top  as string);
  const dx = 50 - left;
  const dy = 50 - top;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = 10; // % směrem ke středu
  return {
    left: `${left + (dx / len) * offset}%`,
    top:  `${top  + (dy / len) * offset}%`,
    transform: "translate(-50%, -50%)",
  };
});

// Figurky pro stadium layout.
// Kontejner má aspect-[20/18] (= STADIUM_ASPECT) — 1 % horiz ≠ 1 % vert v pixelech.
// Správný inward offset: normalizuj vektor v pixelovém prostoru (dx škálujeme A=W/H),
// poté převeď zpět na % — výsledkem je fyzicky stejný inset ve všech směrech po okruhu.
export const FIGURINE_POSITIONS_STADIUM: CSSProperties[] = FIELD_POSITIONS_STADIUM.map((pos) => {
  const left = parseFloat(pos.left as string);
  const top  = parseFloat(pos.top  as string);
  const dx = 50 - left;
  const dy = 50 - top;
  // Normalizace v pixelovém prostoru: dx škálujeme poměrem W/H
  const len = Math.sqrt((STADIUM_ASPECT * dx) ** 2 + dy ** 2) || 1;
  const offset = 6; // % výšky kontejneru — fyzicky konzistentní inset ve všech směrech
  return {
    left: `${left + (dx / len) * offset}%`,
    top:  `${top  + (dy / len) * offset}%`,
    transform: "translate(-50%, -50%)",
  };
});
