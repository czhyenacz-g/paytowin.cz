export interface StableDuelInputEvent {
  type: "stable_duel_input";
  duelId: string;
  playerId: string;
  seq: number;
  at: number;
  input: {
    action: "turn" | "nitro" | "legendary";
    pressed?: boolean;
    direction?: "left" | "right";
  };
}

export interface StableDuelSnapshotEvent {
  type: "stable_duel_snapshot";
  duelId: string;
  tick: number;
  at: number;
  p1: { x: number; y: number; dir: "up" | "down" | "left" | "right" };
  p2: { x: number; y: number; dir: "up" | "down" | "left" | "right" };
  status: string;
}
