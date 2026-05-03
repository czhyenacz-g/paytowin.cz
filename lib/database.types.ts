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
          economy: Json | null;
          fog_of_war: boolean;
          require_approval: boolean;
          xp_awarded: boolean;
          win_stars_awarded: boolean;
          money_spent_awarded: boolean;
        };
        Insert: {
          code: string;
          status?: "waiting" | "playing" | "finished" | "cancelled";
          theme_id?: string | null;
          board_id?: string | null;
          game_mode?: string | null;
          owner_discord_id?: string | null;
          max_players?: number | null;
          economy?: Json | null;
          fog_of_war?: boolean;
          require_approval?: boolean;
          xp_awarded?: boolean;
          win_stars_awarded?: boolean;
          money_spent_awarded?: boolean;
        };
        Update: {
          code?: string;
          status?: "waiting" | "playing" | "finished" | "cancelled";
          theme_id?: string | null;
          board_id?: string | null;
          game_mode?: string | null;
          owner_discord_id?: string | null;
          max_players?: number | null;
          economy?: Json | null;
          fog_of_war?: boolean;
          require_approval?: boolean;
          xp_awarded?: boolean;
          win_stars_awarded?: boolean;
          money_spent_awarded?: boolean;
        };
      };
      spend_events: {
        Row: {
          id: string;
          game_id: string;
          player_id: string | null;
          discord_id: string | null;
          event_type: "racer_purchase" | "move_correction" | "duel_bet" | "event_entry" | "map_publish";
          amount: number;
          metadata: Json | null;
          counted_in_profile: boolean;
          created_at: string;
        };
        Insert: {
          game_id: string;
          player_id?: string | null;
          discord_id?: string | null;
          event_type: "racer_purchase" | "move_correction" | "duel_bet" | "event_entry" | "map_publish";
          amount: number;
          metadata?: Json | null;
          counted_in_profile?: boolean;
        };
        Update: {
          counted_in_profile?: boolean;
          metadata?: Json | null;
        };
      };
      user_profiles: {
        Row: {
          discord_id: string;
          xp_total: number;
          wins_total: number;
          stars_total: number;
          win_stars_total: number;
          money_spent_total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          discord_id: string;
          xp_total?: number;
          wins_total?: number;
          stars_total?: number;
          win_stars_total?: number;
          money_spent_total?: number;
        };
        Update: {
          xp_total?: number;
          wins_total?: number;
          stars_total?: number;
          win_stars_total?: number;
          money_spent_total?: number;
          updated_at?: string;
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
          discord_id: string | null;
          discord_avatar_url: string | null;
          is_bot: boolean;
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
          discord_id?: string | null;
          discord_avatar_url?: string | null;
          is_bot?: boolean;
        };
        Update: {
          position?: number;
          coins?: number;
          horses?: Json;
          color?: string;
          name?: string;
          skip_next_turn?: boolean;
          discord_id?: string | null;
          discord_avatar_url?: string | null;
          is_bot?: boolean;
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
          revealed_fields: Json;
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
          revealed_fields?: Json;
        };
        Update: {
          current_player_index?: number;
          last_roll?: number | null;
          log?: Json;
          turn_count?: number;
          horse_pending?: boolean;
          card_pending?: Json | null;
          offer_pending?: Json | null;
          revealed_fields?: Json;
        };
      };
      game_join_requests: {
        Row: {
          id:                 string;
          game_id:            string;
          name:               string;
          discord_id:         string | null;
          discord_avatar_url: string | null;
          status:             "pending" | "approved" | "rejected";
          created_at:         string;
          reviewed_at:        string | null;
        };
        Insert: {
          game_id:             string;
          name:                string;
          discord_id?:         string | null;
          discord_avatar_url?: string | null;
          status?:             "pending" | "approved" | "rejected";
          reviewed_at?:        string | null;
        };
        Update: {
          name?:               string;
          discord_id?:         string | null;
          discord_avatar_url?: string | null;
          status?:             "pending" | "approved" | "rejected";
          reviewed_at?:        string | null;
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
      racers: {
        Row: {
          id:           string;
          name:         string;
          speed:        number;
          price:        number;
          emoji:        string;
          max_stamina:  number;
          is_legendary: boolean;
          flavor_text:  string | null;
          image_url:    string | null;
          image_path:   string | null;
          type:         string;
          is_builtin:   boolean;
          owner_id:     string | null;
          is_public:    boolean;
          created_at:   string;
          updated_at:   string;
        };
        Insert: {
          id:            string;
          name:          string;
          speed:         number;
          price:         number;
          emoji:         string;
          max_stamina?:  number;
          is_legendary?: boolean;
          flavor_text?:  string | null;
          image_url?:    string | null;
          image_path?:   string | null;
          type?:         string;
          is_builtin?:   boolean;
          owner_id?:     string | null;
          is_public?:    boolean;
        };
        Update: {
          name?:         string;
          speed?:        number;
          price?:        number;
          emoji?:        string;
          max_stamina?:  number;
          is_legendary?: boolean;
          flavor_text?:  string | null;
          image_url?:    string | null;
          image_path?:   string | null;
          type?:         string;
          is_builtin?:   boolean;
          owner_id?:     string | null;
          is_public?:    boolean;
        };
      };
      themes: {
        Row: {
          id: string;
          manifest: Json;
          created_by: string | null;
          is_public: boolean;
          is_official: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          manifest: Json;
          created_by?: string | null;
          is_public?: boolean;
          is_official?: boolean;
          is_archived?: boolean;
        };
        Update: {
          manifest?: Json;
          created_by?: string | null;
          is_public?: boolean;
          is_official?: boolean;
          is_archived?: boolean;
        };
      };
    };
  };
}
