export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      blood_requests: {
        Row: {
          blood_group: string;
          created_at: string;
          hospital_id: string | null;
          id: string;
          latitude: number;
          longitude: number;
          needed_by: string | null;
          notes: string | null;
          patient_name: string | null;
          reason: string | null;
          status: string;
          units_needed: number;
          updated_at: string;
          urgency: string;
          user_id: string;
        };
        Insert: {
          blood_group: string;
          created_at?: string;
          hospital_id?: string | null;
          id?: string;
          latitude: number;
          longitude: number;
          needed_by?: string | null;
          notes?: string | null;
          patient_name?: string | null;
          reason?: string | null;
          status?: string;
          units_needed?: number;
          updated_at?: string;
          urgency?: string;
          user_id: string;
        };
        Update: {
          blood_group?: string;
          created_at?: string;
          hospital_id?: string | null;
          id?: string;
          latitude?: number;
          longitude?: number;
          needed_by?: string | null;
          notes?: string | null;
          patient_name?: string | null;
          reason?: string | null;
          status?: string;
          units_needed?: number;
          updated_at?: string;
          urgency?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blood_requests_hospital_id_fkey";
            columns: ["hospital_id"];
            isOneToOne: false;
            referencedRelation: "hospitals";
            referencedColumns: ["id"];
          },
        ];
      };
      donations: {
        Row: {
          created_at: string;
          donated_at: string;
          donor_id: string;
          donor_user_id: string;
          hospital_id: string | null;
          id: string;
          notes: string | null;
          request_id: string | null;
          units: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          donated_at?: string;
          donor_id: string;
          donor_user_id: string;
          hospital_id?: string | null;
          id?: string;
          notes?: string | null;
          request_id?: string | null;
          units?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          donated_at?: string;
          donor_id?: string;
          donor_user_id?: string;
          hospital_id?: string | null;
          id?: string;
          notes?: string | null;
          request_id?: string | null;
          units?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "donations_donor_id_fkey";
            columns: ["donor_id"];
            isOneToOne: false;
            referencedRelation: "donors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "donations_hospital_id_fkey";
            columns: ["hospital_id"];
            isOneToOne: false;
            referencedRelation: "hospitals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "donations_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "blood_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      donors: {
        Row: {
          address: string | null;
          available_days: string[];
          blood_group: string;
          created_at: string;
          emergency_contact: string | null;
          end_time: string | null;
          full_name: string;
          id: string;
          is_available: boolean;
          latitude: number;
          longitude: number;
          start_time: string | null;
          updated_at: string;
          user_id: string;
          whatsapp_number: string;
        };
        Insert: {
          address?: string | null;
          available_days?: string[];
          blood_group: string;
          created_at?: string;
          emergency_contact?: string | null;
          end_time?: string | null;
          full_name: string;
          id?: string;
          is_available?: boolean;
          latitude: number;
          longitude: number;
          start_time?: string | null;
          updated_at?: string;
          user_id: string;
          whatsapp_number: string;
        };
        Update: {
          address?: string | null;
          available_days?: string[];
          blood_group?: string;
          created_at?: string;
          emergency_contact?: string | null;
          end_time?: string | null;
          full_name?: string;
          id?: string;
          is_available?: boolean;
          latitude?: number;
          longitude?: number;
          start_time?: string | null;
          updated_at?: string;
          user_id?: string;
          whatsapp_number?: string;
        };
        Relationships: [];
      };
      hospitals: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          latitude: number;
          longitude: number;
          name: string;
          phone: string | null;
          updated_at: string;
          verified: boolean;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          latitude: number;
          longitude: number;
          name: string;
          phone?: string | null;
          updated_at?: string;
          verified?: boolean;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
          phone?: string | null;
          updated_at?: string;
          verified?: boolean;
        };
        Relationships: [];
      };
      ml_predictions: {
        Row: {
          created_at: string;
          id: string;
          input: Json | null;
          input_hash: string | null;
          latency_ms: number | null;
          model_name: string;
          model_version: string;
          output: Json | null;
          request_type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          input?: Json | null;
          input_hash?: string | null;
          latency_ms?: number | null;
          model_name: string;
          model_version: string;
          output?: Json | null;
          request_type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          input?: Json | null;
          input_hash?: string | null;
          latency_ms?: number | null;
          model_name?: string;
          model_version?: string;
          output?: Json | null;
          request_type?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          phone: string;
          updated_at: string;
          user_type: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          phone: string;
          updated_at?: string;
          user_type?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          phone?: string;
          updated_at?: string;
          user_type?: string | null;
        };
        Relationships: [];
      };
      request_responses: {
        Row: {
          created_at: string;
          donor_id: string;
          donor_user_id: string;
          id: string;
          ml_reasons: Json | null;
          ml_score: number | null;
          request_id: string;
          request_user_id: string;
          responded_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          donor_id: string;
          donor_user_id: string;
          id?: string;
          ml_reasons?: Json | null;
          ml_score?: number | null;
          request_id: string;
          request_user_id: string;
          responded_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          donor_id?: string;
          donor_user_id?: string;
          id?: string;
          ml_reasons?: Json | null;
          ml_score?: number | null;
          request_id?: string;
          request_user_id?: string;
          responded_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_responses_donor_id_fkey";
            columns: ["donor_id"];
            isOneToOne: false;
            referencedRelation: "donors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_responses_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "blood_requests";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_available_donors: {
        Args: never;
        Returns: {
          available_days: string[];
          blood_group: string;
          created_at: string;
          end_time: string;
          full_name: string;
          id: string;
          is_available: boolean;
          latitude: number;
          longitude: number;
          start_time: string;
          updated_at: string;
          user_id: string;
          whatsapp_number: string;
        }[];
      };
      get_donor_detail: {
        Args: { _donor_id: string };
        Returns: {
          available_days: string[];
          blood_group: string;
          created_at: string;
          end_time: string;
          full_name: string;
          id: string;
          is_available: boolean;
          latitude: number;
          longitude: number;
          start_time: string;
          updated_at: string;
          user_id: string;
          whatsapp_number: string;
        }[];
      };
      get_match_candidates: {
        Args: { _request_id: string };
        Returns: {
          available_days: string[];
          blood_group: string;
          donor_id: string;
          end_time: string;
          full_name: string;
          is_available: boolean;
          last_donation_at: string;
          latitude: number;
          longitude: number;
          response_rate: number;
          start_time: string;
          total_donations: number;
        }[];
      };
      get_open_blood_requests: {
        Args: never;
        Returns: {
          blood_group: string;
          created_at: string;
          id: string;
          latitude: number;
          longitude: number;
          needed_by: string;
          status: string;
          units_needed: number;
          urgency: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
