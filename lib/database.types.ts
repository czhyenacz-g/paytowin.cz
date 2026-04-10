export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          code: string;
          status: "waiting" | "playing" | "finished";
          created_at: string;
        };
        Insert: {
          code: string;
          status?: "waiting" | "playing" | "finished";
        };
        Update: {
          code?: string;
          status?: "waiting" | "playing" | "finished";
        };
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          name: string;
          color: string;
          position: number;
          coins: number;
          horses: Json;
          turn_order: number;
        };
        Insert: {
          game_id: string;
          name: string;
          color: string;
          position: number;
          coins: number;
          horses: Json;
          turn_order: number;
        };
        Update: {
          position?: number;
          coins?: number;
          horses?: Json;
          color?: string;
          name?: string;
        };
      };
      game_state: {
        Row: {
          game_id: string;
          current_player_index: number;
          last_roll: number | null;
          log: Json;
          turn_count: number;
          updated_at: string;
        };
        Insert: {
          game_id: string;
          current_player_index: number;
          last_roll?: number | null;
          log: Json;
          turn_count?: number;
        };
        Update: {
          current_player_index?: number;
          last_roll?: number | null;
          log?: Json;
          turn_count?: number;
        };
      };
      horse_catalog: {
        Row: {
          id: string;
          name: string;
          speed: number;
          price: number;
          emoji: string;
        };
        Insert: {
          name: string;
          speed: number;
          price: number;
          emoji: string;
        };
        Update: {
          name?: string;
          speed?: number;
          price?: number;
          emoji?: string;
        };
      };
    };
  };
}
