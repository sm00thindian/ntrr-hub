export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          created_at: string
          dedupe_key: string | null
          dismissed_at: string | null
          household_id: string
          id: string
          payload: Json
          snoozed_until: string | null
          type: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          household_id: string
          id?: string
          payload?: Json
          snoozed_until?: string | null
          type: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          household_id?: string
          id?: string
          payload?: Json
          snoozed_until?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          household_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          household_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          household_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          household_id: string
          id: string
          location: string | null
          provenance: Json
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          household_id: string
          id?: string
          location?: string | null
          provenance?: Json
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          household_id?: string
          id?: string
          location?: string | null
          provenance?: Json
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          calendar_settings: Json
          created_at: string
          created_by: string
          id: string
          name: string
          reliant_connected_at: string | null
          reliant_connected_by: string | null
          updated_at: string
        }
        Insert: {
          calendar_settings?: Json
          created_at?: string
          created_by: string
          id?: string
          name: string
          reliant_connected_at?: string | null
          reliant_connected_by?: string | null
          updated_at?: string
        }
        Update: {
          calendar_settings?: Json
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          reliant_connected_at?: string | null
          reliant_connected_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      integration_accounts: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          metadata: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes: string[] | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          metadata?: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          metadata?: Json
          provider?: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["household_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_task_templates: {
        Row: {
          cadence: Database["public"]["Enums"]["recurrence_cadence"]
          created_at: string
          created_by: string
          day_of_month: number | null
          day_of_week: number | null
          default_assignee_id: string | null
          description: string | null
          due_time: string | null
          household_id: string
          id: string
          is_active: boolean
          reliant_confirm_requested: boolean
          reliant_sms_reminder_requested: boolean
          title: string
          updated_at: string
        }
        Insert: {
          cadence?: Database["public"]["Enums"]["recurrence_cadence"]
          created_at?: string
          created_by: string
          day_of_month?: number | null
          day_of_week?: number | null
          default_assignee_id?: string | null
          description?: string | null
          due_time?: string | null
          household_id: string
          id?: string
          is_active?: boolean
          reliant_confirm_requested?: boolean
          reliant_sms_reminder_requested?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          cadence?: Database["public"]["Enums"]["recurrence_cadence"]
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          day_of_week?: number | null
          default_assignee_id?: string | null
          description?: string | null
          due_time?: string | null
          household_id?: string
          id?: string
          is_active?: boolean
          reliant_confirm_requested?: boolean
          reliant_sms_reminder_requested?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_templates_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_conflicts: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["sync_entity_type"]
          field_name: string
          household_id: string
          id: string
          local_value: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          remote_value: Json | null
          resolution:
            | Database["public"]["Enums"]["sync_conflict_resolution"]
            | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["sync_conflict_status"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["sync_entity_type"]
          field_name: string
          household_id: string
          id?: string
          local_value?: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          remote_value?: Json | null
          resolution?:
            | Database["public"]["Enums"]["sync_conflict_resolution"]
            | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["sync_conflict_status"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["sync_entity_type"]
          field_name?: string
          household_id?: string
          id?: string
          local_value?: Json | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          remote_value?: Json | null
          resolution?:
            | Database["public"]["Enums"]["sync_conflict_resolution"]
            | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["sync_conflict_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_mappings: {
        Row: {
          created_at: string
          entity_type: Database["public"]["Enums"]["sync_entity_type"]
          external_etag: string | null
          external_id: string
          external_updated_at: string | null
          household_id: string
          id: string
          ntrr_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: Database["public"]["Enums"]["sync_entity_type"]
          external_etag?: string | null
          external_id: string
          external_updated_at?: string | null
          household_id: string
          id?: string
          ntrr_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: Database["public"]["Enums"]["sync_entity_type"]
          external_etag?: string | null
          external_id?: string
          external_updated_at?: string | null
          household_id?: string
          id?: string
          ntrr_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_mappings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_outbox: {
        Row: {
          attempts: number
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["sync_entity_type"]
          household_id: string
          id: string
          last_error: string | null
          operation: Database["public"]["Enums"]["sync_outbox_operation"]
          payload: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          scheduled_at: string
          status: Database["public"]["Enums"]["sync_outbox_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["sync_entity_type"]
          household_id: string
          id?: string
          last_error?: string | null
          operation: Database["public"]["Enums"]["sync_outbox_operation"]
          payload?: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          scheduled_at?: string
          status?: Database["public"]["Enums"]["sync_outbox_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["sync_entity_type"]
          household_id?: string
          id?: string
          last_error?: string | null
          operation?: Database["public"]["Enums"]["sync_outbox_operation"]
          payload?: Json
          provider?: Database["public"]["Enums"]["integration_provider"]
          scheduled_at?: string
          status?: Database["public"]["Enums"]["sync_outbox_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_outbox_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          household_id: string
          id: string
          provenance: Json
          recurring_template_id: string | null
          reliant_confirm_requested: boolean
          reliant_sms_reminder_requested: boolean
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          household_id: string
          id?: string
          provenance?: Json
          recurring_template_id?: string | null
          reliant_confirm_requested?: boolean
          reliant_sms_reminder_requested?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          household_id?: string
          id?: string
          provenance?: Json
          recurring_template_id?: string | null
          reliant_confirm_requested?: boolean
          reliant_sms_reminder_requested?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_tasks: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      create_household: { Args: { household_name: string }; Returns: string }
      get_invite_preview: {
        Args: { invite_token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          household_id: string
          household_name: string
          id: string
          revoked_at: string
          role: Database["public"]["Enums"]["household_role"]
        }[]
      }
      has_household_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["household_role"][]
          target_household_id: string
        }
        Returns: boolean
      }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
    }
    Enums: {
      household_role: "owner" | "admin" | "caregiver" | "viewer"
      integration_provider: "google" | "microsoft" | "apple_caldav" | "zapier"
      integration_status: "connected" | "disconnected" | "error" | "pending"
      recurrence_cadence: "daily" | "weekly" | "monthly"
      sync_conflict_resolution: "keep_local" | "keep_remote" | "merged"
      sync_conflict_status: "pending" | "resolved"
      sync_entity_type: "task" | "calendar_event"
      sync_outbox_operation: "create" | "update" | "delete"
      sync_outbox_status: "pending" | "processing" | "done" | "failed"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      household_role: ["owner", "admin", "caregiver", "viewer"],
      integration_provider: ["google", "microsoft", "apple_caldav", "zapier"],
      integration_status: ["connected", "disconnected", "error", "pending"],
      recurrence_cadence: ["daily", "weekly", "monthly"],
      sync_conflict_resolution: ["keep_local", "keep_remote", "merged"],
      sync_conflict_status: ["pending", "resolved"],
      sync_entity_type: ["task", "calendar_event"],
      sync_outbox_operation: ["create", "update", "delete"],
      sync_outbox_status: ["pending", "processing", "done", "failed"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
    },
  },
} as const

