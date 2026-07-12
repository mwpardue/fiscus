export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          after_values: Json | null;
          before_values: Json | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          event_type: Database["public"]["Enums"]["audit_event_type"];
          id: string;
          reason: string;
          user_id: string;
        };
        Insert: {
          after_values?: Json | null;
          before_values?: Json | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          event_type: Database["public"]["Enums"]["audit_event_type"];
          id?: string;
          reason: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          color_token: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["category_kind"];
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color_token?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["category_kind"];
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      counterparties: {
        Row: {
          brandfetch_brand_id: string | null;
          brandfetch_domain: string | null;
          brandfetch_icon_url: string | null;
          brandfetch_name: string | null;
          brandfetch_updated_at: string | null;
          created_at: string;
          id: string;
          icon_storage_path: string | null;
          icon_updated_at: string | null;
          kind: Database["public"]["Enums"]["counterparty_kind"];
          name: string;
          notes: string | null;
          updated_at: string;
          user_id: string;
          website_url: string | null;
        };
        Insert: {
          brandfetch_brand_id?: string | null;
          brandfetch_domain?: string | null;
          brandfetch_icon_url?: string | null;
          brandfetch_name?: string | null;
          brandfetch_updated_at?: string | null;
          created_at?: string;
          id?: string;
          icon_storage_path?: string | null;
          icon_updated_at?: string | null;
          kind?: Database["public"]["Enums"]["counterparty_kind"];
          name: string;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
          website_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["counterparties"]["Insert"]>;
        Relationships: [];
      };
      financial_items: {
        Row: {
          archived_at: string | null;
          brandfetch_brand_id: string | null;
          brandfetch_domain: string | null;
          brandfetch_icon_url: string | null;
          brandfetch_name: string | null;
          brandfetch_updated_at: string | null;
          category_id: string | null;
          color_token: string | null;
          counterparty_id: string | null;
          created_at: string;
          currency_code: string;
          default_amount_status: Database["public"]["Enums"]["amount_status"];
          default_expected_amount_minor: number | null;
          description: string | null;
          hide_archived_history: boolean;
          id: string;
          icon_storage_path: string | null;
          icon_updated_at: string | null;
          kind: Database["public"]["Enums"]["financial_item_kind"];
          name: string;
          status: Database["public"]["Enums"]["financial_item_status"];
          theme_token: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          brandfetch_brand_id?: string | null;
          brandfetch_domain?: string | null;
          brandfetch_icon_url?: string | null;
          brandfetch_name?: string | null;
          brandfetch_updated_at?: string | null;
          category_id?: string | null;
          color_token?: string | null;
          counterparty_id?: string | null;
          created_at?: string;
          currency_code: string;
          default_amount_status: Database["public"]["Enums"]["amount_status"];
          default_expected_amount_minor?: number | null;
          description?: string | null;
          hide_archived_history?: boolean;
          id?: string;
          icon_storage_path?: string | null;
          icon_updated_at?: string | null;
          kind: Database["public"]["Enums"]["financial_item_kind"];
          name: string;
          status?: Database["public"]["Enums"]["financial_item_status"];
          theme_token?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["financial_items"]["Insert"]>;
        Relationships: [];
      };
      occurrences: {
        Row: {
          actual_amount_minor: number | null;
          amount_status: Database["public"]["Enums"]["amount_status"];
          archived_at: string | null;
          completed_at: string | null;
          created_at: string;
          currency_code: string;
          due_date: string;
          expected_amount_minor: number | null;
          financial_item_id: string;
          id: string;
          lifecycle_status: Database["public"]["Enums"]["occurrence_lifecycle_status"];
          notes: string | null;
          recurrence_rule_id: string | null;
          sequence_number: number | null;
          source: Database["public"]["Enums"]["occurrence_source"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actual_amount_minor?: number | null;
          amount_status: Database["public"]["Enums"]["amount_status"];
          archived_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          currency_code: string;
          due_date: string;
          expected_amount_minor?: number | null;
          financial_item_id: string;
          id?: string;
          lifecycle_status?: Database["public"]["Enums"]["occurrence_lifecycle_status"];
          notes?: string | null;
          recurrence_rule_id?: string | null;
          sequence_number?: number | null;
          source: Database["public"]["Enums"]["occurrence_source"];
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["occurrences"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "occurrences_item_owner_fk";
            columns: ["financial_item_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "financial_items";
            referencedColumns: ["id", "user_id"];
          }
        ];
      };
      payments: {
        Row: {
          amount_minor: number;
          completed_on: string;
          created_at: string;
          currency_code: string;
          id: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          occurrence_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
          user_id: string;
          void_reason: string | null;
          voided_at: string | null;
        };
        Insert: {
          amount_minor: number;
          completed_on: string;
          created_at?: string;
          currency_code: string;
          id?: string;
          kind: Database["public"]["Enums"]["payment_kind"];
          occurrence_id: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
          user_id: string;
          void_reason?: string | null;
          voided_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      rate_limit_events: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          identifier_hash: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          identifier_hash: string;
          user_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limit_events"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          balance_anchor_amount_minor: number | null;
          balance_anchor_recorded_at: string | null;
          created_at: string;
          default_currency_code: string;
          theme_token: string;
          timezone: string;
          updated_at: string;
          user_id: string;
          week_starts_on: number;
        };
        Insert: {
          balance_anchor_amount_minor?: number | null;
          balance_anchor_recorded_at?: string | null;
          created_at?: string;
          default_currency_code?: string;
          theme_token?: string;
          timezone?: string;
          updated_at?: string;
          user_id: string;
          week_starts_on?: number;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      recurrence_rules: {
        Row: {
          anchor_date: string | null;
          anchor_day: number | null;
          anchor_weekday: number | null;
          converted_from_rule_id: string | null;
          created_at: string;
          ends_on: string | null;
          financial_item_id: string;
          id: string;
          interval_count: number | null;
          interval_unit: Database["public"]["Enums"]["interval_unit"] | null;
          ordinal_week: number | null;
          mode: Database["public"]["Enums"]["schedule_mode"];
          occurrence_count: number | null;
          schedule_basis: string;
          short_month_behavior: Database["public"]["Enums"]["short_month_behavior"] | null;
          status: Database["public"]["Enums"]["recurrence_rule_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          anchor_date?: string | null;
          anchor_day?: number | null;
          anchor_weekday?: number | null;
          converted_from_rule_id?: string | null;
          created_at?: string;
          ends_on?: string | null;
          financial_item_id: string;
          id?: string;
          interval_count?: number | null;
          interval_unit?: Database["public"]["Enums"]["interval_unit"] | null;
          ordinal_week?: number | null;
          mode: Database["public"]["Enums"]["schedule_mode"];
          occurrence_count?: number | null;
          schedule_basis?: string;
          short_month_behavior?: Database["public"]["Enums"]["short_month_behavior"] | null;
          status?: Database["public"]["Enums"]["recurrence_rule_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["recurrence_rules"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      add_generated_schedule_to_financial_item: {
        Args: {
          p_anchor_date: string;
          p_anchor_day: number | null;
          p_anchor_weekday?: number | null;
          p_due_dates: string[];
          p_financial_item_id: string;
          p_interval_count: number;
          p_interval_unit: Database["public"]["Enums"]["interval_unit"];
          p_mode: Database["public"]["Enums"]["schedule_mode"];
          p_occurrence_count: number | null;
          p_ordinal_week?: number | null;
          p_schedule_basis?: string;
          p_short_month_behavior:
            | Database["public"]["Enums"]["short_month_behavior"]
            | null;
        };
        Returns: string;
      };
      create_generated_financial_item: {
        Args: {
          p_anchor_date: string;
          p_anchor_day: number | null;
          p_currency_code: string;
          p_default_amount_status: Database["public"]["Enums"]["amount_status"];
          p_default_expected_amount_minor: number | null;
          p_due_dates: string[];
          p_interval_count: number;
          p_interval_unit: Database["public"]["Enums"]["interval_unit"];
          p_anchor_weekday?: number | null;
          p_kind: Database["public"]["Enums"]["financial_item_kind"];
          p_mode: Database["public"]["Enums"]["schedule_mode"];
          p_name: string;
          p_occurrence_count: number | null;
          p_ordinal_week?: number | null;
          p_schedule_basis?: string;
          p_short_month_behavior:
            | Database["public"]["Enums"]["short_month_behavior"]
            | null;
        };
        Returns: string;
      };
      create_manual_financial_item: {
        Args: {
          p_currency_code: string;
          p_default_amount_status: Database["public"]["Enums"]["amount_status"];
          p_default_expected_amount_minor: number | null;
          p_due_dates: string[];
          p_kind: Database["public"]["Enums"]["financial_item_kind"];
          p_name: string;
        };
        Returns: string;
      };
      archive_financial_item: {
        Args: {
          p_financial_item_id: string;
          p_hide_archived_history?: boolean;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["financial_items"]["Row"];
      };
      archive_occurrence: {
        Args: { p_occurrence_id: string; p_reason?: string | null };
        Returns: Database["public"]["Tables"]["occurrences"]["Row"];
      };
      complete_occurrence: {
        Args: {
          p_occurrence_id: string;
          p_amount_minor: number;
          p_completed_on: string;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["occurrences"]["Row"];
      };
      check_rate_limit: {
        Args: {
          p_action: string;
          p_identifier: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      reopen_occurrence: {
        Args: { p_occurrence_id: string; p_reason?: string | null };
        Returns: Database["public"]["Tables"]["occurrences"]["Row"];
      };
      replace_recurrence_rule: {
        Args: {
          p_rule_id: string;
          p_mode: Database["public"]["Enums"]["schedule_mode"];
          p_interval_unit: Database["public"]["Enums"]["interval_unit"] | null;
          p_interval_count: number | null;
          p_anchor_date: string | null;
          p_anchor_day: number | null;
          p_short_month_behavior:
            | Database["public"]["Enums"]["short_month_behavior"]
            | null;
          p_ends_on: string | null;
          p_occurrence_count: number | null;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["recurrence_rules"]["Row"];
      };
      restore_user_backup: {
        Args: { p_backup: Json };
        Returns: void;
      };
      skip_occurrence: {
        Args: { p_occurrence_id: string; p_reason?: string | null };
        Returns: Database["public"]["Tables"]["occurrences"]["Row"];
      };
    };
    Enums: {
      amount_status: "fixed" | "estimated" | "unknown";
      audit_event_type:
        | "occurrence_completed"
        | "occurrence_reopened"
        | "occurrence_skipped"
        | "completed_occurrence_corrected"
        | "payment_voided"
        | "schedule_edited"
        | "occurrence_archived"
        | "financial_item_archived";
      category_kind: "bill" | "income" | "both";
      counterparty_kind: "biller" | "payer" | "person" | "merchant" | "other";
      financial_item_kind: "bill" | "income";
      financial_item_status: "active" | "archived";
      interval_unit: "day" | "week" | "month" | "year";
      occurrence_lifecycle_status: "upcoming" | "paid" | "received" | "skipped";
      occurrence_source: "generated" | "manual";
      payment_kind: "payment" | "receipt";
      payment_status: "active" | "voided";
      recurrence_rule_status: "active" | "superseded" | "archived";
      schedule_mode: "ongoing" | "finite" | "manual";
      short_month_behavior: "last_day" | "next_month" | "skip";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
