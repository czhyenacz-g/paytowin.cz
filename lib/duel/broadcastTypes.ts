export interface StableDuelInputEvent {
  type: "stable_duel_input";
  duelId: string;
  playerId: string;
  seq: number;
  at: number;
  input: {
    action: "turn" | "nitro";
    pressed?: boolean;
    direction?: "left" | "right";
  };
}
