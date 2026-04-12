export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          code: string;
          status: "waiting" | "playing" | "finished" | "cancelled";
          created_at: string;
          theme_id: string | null;
          board_id: string | null;
          game_mode: string | null;
          owner_discord_id: string | null;
          max_players: number | null;
        };
        Insert: {
          code: string;
          status?: "waiting" | "playing" | "finished" | "cancelled";
          theme_id?: string | null;
          board_id?: string | null;
          game_mode?: string | null;
          owner_discord_id?: string | null;
          max_players?: number | null;
        };
        Update: {
          code?: string;
          status?: "waiting" | "playing" | "finished" | "cancelled";
          theme_id?: string | null;
          board_id?: string | null;
          game_mode?: string | null;
          owner_discord_id?: string | null;
          max_players?: number | null;
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
          skip_next_turn: boolean;
        };
        Insert: {
          game_id: string;
          name: string;
          color: string;
          position: number;
          coins: number;
          horses: Json;
          turn_order: number;
          skip_next_turn?: boolean;
        };
        Update: {
          position?: number;
          coins?: number;
          horses?: Json;
          color?: string;
          name?: string;
          skip_next_turn?: boolean;
        };
      };
      game_state: {
        Row: {
          game_id: string;
          current_player_index: number;
          last_roll: number | null;
          log: Json;
          turn_count: number;
          horse_pending: boolean;
          card_pending: Json | null;
          offer_pending: Json | null;
          updated_at: string;
        };
        Insert: {
          game_id: string;
          current_player_index: number;
          last_roll?: number | null;
          log: Json;
          turn_count?: number;
          horse_pending?: boolean;
          card_pending?: Json | null;
          offer_pending?: Json | null;
        };
        Update: {
          current_player_index?: number;
          last_roll?: number | null;
          log?: Json;
          turn_count?: number;
          horse_pending?: boolean;
          card_pending?: Json | null;
          offer_pending?: Json | null;
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
