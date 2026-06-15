import { describe, it, expect } from "vitest";
import {
  applyStaminaLossToHorseList,
  applyStableDuelSettlementHorses,
} from "./apply-stable-duel-settlement";
import type { Horse } from "@/lib/types/game";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function horse(overrides: Partial<Horse> & { name: string }): Horse {
  return {
    speed: 5,
    price: 1000,
    emoji: "🐴",
    stamina: 100,
    maxStamina: 100,
    ...overrides,
  };
}

const KEY_A = "alpha";
const KEY_B = "beta";

const horseA = horse({ id: KEY_A, name: KEY_A, stamina: 120, maxStamina: 120 });
const horseB = horse({ id: KEY_B, name: KEY_B, stamina: 80,  maxStamina: 100 });

// ── applyStaminaLossToHorseList ───────────────────────────────────────────────

describe("applyStaminaLossToHorseList", () => {
  it("racer stamina 120, loss 100 → stamina 20, racerLost false", () => {
    const result = applyStaminaLossToHorseList([horseA], KEY_A, 100);
    expect(result.racerLost).toBe(false);
    expect(result.horses).toHaveLength(1);
    expect(result.horses[0].stamina).toBe(20);
  });

  it("racer stamina 100, loss 100 → racer odstraněn, racerLost true", () => {
    const h = horse({ id: "x", name: "x", stamina: 100 });
    const result = applyStaminaLossToHorseList([h], "x", 100);
    expect(result.racerLost).toBe(true);
    expect(result.horses).toHaveLength(0);
  });

  it("racer stamina 90, loss 100 → racer odstraněn (clamp na 0), racerLost true", () => {
    const h = horse({ id: "x", name: "x", stamina: 90 });
    const result = applyStaminaLossToHorseList([h], "x", 100);
    expect(result.racerLost).toBe(true);
    expect(result.horses).toHaveLength(0);
  });

  it("racer key neexistuje → seznam beze změny, racerLost false", () => {
    const result = applyStaminaLossToHorseList([horseA, horseB], "nonexistent", 50);
    expect(result.racerLost).toBe(false);
    expect(result.horses).toHaveLength(2);
  });

  it("racerKey null → seznam beze změny, racerLost false", () => {
    const result = applyStaminaLossToHorseList([horseA, horseB], null, 50);
    expect(result.racerLost).toBe(false);
    expect(result.horses).toHaveLength(2);
  });

  it("prázdný seznam → beze změny, racerLost false", () => {
    const result = applyStaminaLossToHorseList([], KEY_A, 50);
    expect(result.racerLost).toBe(false);
    expect(result.horses).toHaveLength(0);
  });

  it("nezmění ostatní racery při aplikaci lossu na jednoho", () => {
    const result = applyStaminaLossToHorseList([horseA, horseB], KEY_A, 10);
    expect(result.horses).toHaveLength(2);
    const b = result.horses.find(h => h.id === KEY_B);
    expect(b?.stamina).toBe(horseB.stamina); // horseB nedotčen
  });

  it("po odstranění racera se normalizuje isPreferred (druhý racer stane preferovaný)", () => {
    const preferred = horse({ id: "p", name: "p", stamina: 50, isPreferred: true });
    const other     = horse({ id: "o", name: "o", stamina: 50 });
    // odstraníme preferred → normalizeFavoriteHorse nastaví other jako preferred
    const result = applyStaminaLossToHorseList([preferred, other], "p", 100);
    expect(result.racerLost).toBe(true);
    expect(result.horses).toHaveLength(1);
    // po normalizaci musí zbývající racer dostat isPreferred=true
    expect(result.horses[0].isPreferred).toBe(true);
  });
});

// ── applyStableDuelSettlementHorses ──────────────────────────────────────────

describe("applyStableDuelSettlementHorses", () => {
  it("challenger dostane loss, defender dostane loss (APPLY_BOT_STAMINA_LOSS=true)", () => {
    // flag je true v aktuálním stavu projektu
    const cHorses = [horse({ id: KEY_A, name: KEY_A, stamina: 100 })];
    const dHorses = [horse({ id: KEY_B, name: KEY_B, stamina: 100 })];

    const r = applyStableDuelSettlementHorses(cHorses, dHorses, KEY_A, KEY_B, 30, 30);

    expect(r.updatedCHorses[0].stamina).toBe(70);
    expect(r.challengerRacerLost).toBe(false);
    expect(r.updatedDHorses[0].stamina).toBe(70);
    expect(r.defenderRacerLost).toBe(false);
  });

  it("challenger racer ztracen při loss >= stamina", () => {
    const cHorses = [horse({ id: KEY_A, name: KEY_A, stamina: 40 })];
    const dHorses = [horse({ id: KEY_B, name: KEY_B, stamina: 100 })];

    const r = applyStableDuelSettlementHorses(cHorses, dHorses, KEY_A, KEY_B, 50, 30);

    expect(r.challengerRacerLost).toBe(true);
    expect(r.updatedCHorses).toHaveLength(0);
    expect(r.defenderRacerLost).toBe(false);
  });

  it("null klíče pro oba → žádná změna horses", () => {
    const cHorses = [horse({ id: KEY_A, name: KEY_A, stamina: 100 })];
    const dHorses = [horse({ id: KEY_B, name: KEY_B, stamina: 100 })];

    const r = applyStableDuelSettlementHorses(cHorses, dHorses, null, null, 50, 50);

    expect(r.challengerRacerLost).toBe(false);
    expect(r.defenderRacerLost).toBe(false);
    expect(r.updatedCHorses[0].stamina).toBe(100);
    expect(r.updatedDHorses[0].stamina).toBe(100);
  });
});
