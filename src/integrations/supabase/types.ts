export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          finding_id: string | null
          id: string
          report_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          finding_id?: string | null
          id?: string
          report_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          finding_id?: string | null
          id?: string
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_contacts: {
        Row: {
          created_at: string
          directory_id: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          receives_copies: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          directory_id: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          receives_copies?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          directory_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          receives_copies?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "directory_contacts_directory_id_fkey"
            columns: ["directory_id"]
            isOneToOne: false
            referencedRelation: "project_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      distributions: {
        Row: {
          channel: Database["public"]["Enums"]["distribution_channel"]
          created_at: string
          directory_id: string | null
          document_path: string | null
          error: string | null
          finding_ids: string[]
          id: string
          opened_at: string | null
          recipient_snapshot: Json
          report_id: string
          sent_at: string | null
          sent_by: string | null
          status: string
          trade: string | null
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["distribution_channel"]
          created_at?: string
          directory_id?: string | null
          document_path?: string | null
          error?: string | null
          finding_ids?: string[]
          id?: string
          opened_at?: string | null
          recipient_snapshot?: Json
          report_id: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["distribution_channel"]
          created_at?: string
          directory_id?: string | null
          document_path?: string | null
          error?: string | null
          finding_ids?: string[]
          id?: string
          opened_at?: string | null
          recipient_snapshot?: Json
          report_id?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributions_directory_id_fkey"
            columns: ["directory_id"]
            isOneToOne: false
            referencedRelation: "project_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      finding_photos: {
        Row: {
          created_at: string
          finding_id: string
          id: string
          photo_id: string
          region: Json | null
          role: Database["public"]["Enums"]["finding_photo_role"]
        }
        Insert: {
          created_at?: string
          finding_id: string
          id?: string
          photo_id: string
          region?: Json | null
          role?: Database["public"]["Enums"]["finding_photo_role"]
        }
        Update: {
          created_at?: string
          finding_id?: string
          id?: string
          photo_id?: string
          region?: Json | null
          role?: Database["public"]["Enums"]["finding_photo_role"]
        }
        Relationships: [
          {
            foreignKeyName: "finding_photos_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finding_photos_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          ai_confidence: number | null
          ai_raw_output: Json | null
          ai_suggested_trade: string | null
          ai_trade_confidence: number | null
          ai_trade_reasoning: string | null
          assigned_contact_id: string | null
          assigned_trade: string | null
          capture_fields: Json
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          due_date: string | null
          finding_text: string | null
          hazard_category: string | null
          human_edited: boolean
          id: string
          is_confidential: boolean
          lifecycle_state: string
          ref: string
          remedial_text: string | null
          report_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sequence: number
          severity: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_raw_output?: Json | null
          ai_suggested_trade?: string | null
          ai_trade_confidence?: number | null
          ai_trade_reasoning?: string | null
          assigned_contact_id?: string | null
          assigned_trade?: string | null
          capture_fields?: Json
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_date?: string | null
          finding_text?: string | null
          hazard_category?: string | null
          human_edited?: boolean
          id?: string
          is_confidential?: boolean
          lifecycle_state?: string
          ref: string
          remedial_text?: string | null
          report_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sequence?: number
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_raw_output?: Json | null
          ai_suggested_trade?: string | null
          ai_trade_confidence?: number | null
          ai_trade_reasoning?: string | null
          assigned_contact_id?: string | null
          assigned_trade?: string | null
          capture_fields?: Json
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_date?: string | null
          finding_text?: string | null
          hazard_category?: string | null
          human_edited?: boolean
          id?: string
          is_confidential?: boolean
          lifecycle_state?: string
          ref?: string
          remedial_text?: string | null
          report_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sequence?: number
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          address: string | null
          brand_colour: string | null
          created_at: string
          id: string
          logo_path: string | null
          name: string
        }
        Insert: {
          address?: string | null
          brand_colour?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
        }
        Update: {
          address?: string | null
          brand_colour?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          blurred_path: string | null
          captured_at: string | null
          created_at: string
          faces_detected: boolean
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          original_filename: string | null
          report_id: string
          sequence: number
          storage_path: string
          thumbnail_path: string | null
          width: number | null
        }
        Insert: {
          blurred_path?: string | null
          captured_at?: string | null
          created_at?: string
          faces_detected?: boolean
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          original_filename?: string | null
          report_id: string
          sequence?: number
          storage_path: string
          thumbnail_path?: string | null
          width?: number | null
        }
        Update: {
          blurred_path?: string | null
          captured_at?: string | null
          created_at?: string
          faces_detected?: boolean
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          original_filename?: string | null
          report_id?: string
          sequence?: number
          storage_path?: string
          thumbnail_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      project_directory: {
        Row: {
          company_name: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          project_id: string
          trade: string
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          project_id: string
          trade: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          project_id?: string
          trade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_directory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          client_name: string | null
          created_at: string
          id: string
          name: string
          organisation_id: string
          principal_contractor: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          name: string
          organisation_id: string
          principal_contractor?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          name?: string
          organisation_id?: string
          principal_contractor?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          author_id: string | null
          created_at: string
          executive_summary: string | null
          id: string
          issued_at: string | null
          methodology_text: string | null
          organisation_id: string
          project_id: string
          reference: string | null
          report_date: string
          scope_text: string | null
          status: string
          subtitle: string | null
          survey_type_id: string | null
          survey_type_snapshot: Json
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          executive_summary?: string | null
          id?: string
          issued_at?: string | null
          methodology_text?: string | null
          organisation_id: string
          project_id: string
          reference?: string | null
          report_date?: string
          scope_text?: string | null
          status?: string
          subtitle?: string | null
          survey_type_id?: string | null
          survey_type_snapshot: Json
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          executive_summary?: string | null
          id?: string
          issued_at?: string | null
          methodology_text?: string | null
          organisation_id?: string
          project_id?: string
          reference?: string | null
          report_date?: string
          scope_text?: string | null
          status?: string
          subtitle?: string | null
          survey_type_id?: string | null
          survey_type_snapshot?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_survey_type_id_fkey"
            columns: ["survey_type_id"]
            isOneToOne: false
            referencedRelation: "survey_type_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_type_definitions: {
        Row: {
          created_at: string
          definition: Json
          id: string
          is_active: boolean
          organisation_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          definition: Json
          id?: string
          is_active?: boolean
          organisation_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          definition?: Json
          id?: string
          is_active?: boolean
          organisation_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "survey_type_definitions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organisation: { Args: { _name: string }; Returns: string }
      directory_org: { Args: { _directory_id: string }; Returns: string }
      finding_is_confidential: {
        Args: { _finding_id: string }
        Returns: boolean
      }
      finding_org: { Args: { _finding_id: string }; Returns: string }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      project_org: { Args: { _project_id: string }; Returns: string }
      report_org: { Args: { _report_id: string }; Returns: string }
      safe_uuid: { Args: { _t: string }; Returns: string }
    }
    Enums: {
      app_role: "owner" | "admin" | "surveyor" | "viewer" | "supervisor"
      distribution_channel: "email" | "link" | "manual"
      finding_photo_role: "primary" | "detail" | "closeout"
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
  public: {
    Enums: {
      app_role: ["owner", "admin", "surveyor", "viewer", "supervisor"],
      distribution_channel: ["email", "link", "manual"],
      finding_photo_role: ["primary", "detail", "closeout"],
    },
  },
} as const
