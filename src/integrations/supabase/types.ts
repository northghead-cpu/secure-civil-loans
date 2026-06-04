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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action_performed: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          role: string
          table_name: string | null
          user_id: string
        }
        Insert: {
          action_performed: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          role: string
          table_name?: string | null
          user_id: string
        }
        Update: {
          action_performed?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          role?: string
          table_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bank_products: {
        Row: {
          active: boolean | null
          bank_name: string | null
          created_at: string | null
          id: string
          interest_rate: number | null
          max_amount: number | null
          max_term_months: number | null
          min_amount: number | null
          processing_days: number | null
        }
        Insert: {
          active?: boolean | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          interest_rate?: number | null
          max_amount?: number | null
          max_term_months?: number | null
          min_amount?: number | null
          processing_days?: number | null
        }
        Update: {
          active?: boolean | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          interest_rate?: number | null
          max_amount?: number | null
          max_term_months?: number | null
          min_amount?: number | null
          processing_days?: number | null
        }
        Relationships: []
      }
      credit_checks: {
        Row: {
          adverse_count: number | null
          checked_by: string
          created_at: string
          full_name: string
          id: string
          nrc_number: string
          open_accounts: number | null
          probability_of_default: number | null
          recommendation: string | null
          risk_level: string | null
          score: number | null
          score_rating: string | null
          status: string
          summary: string | null
          total_outstanding_zmw: number | null
        }
        Insert: {
          adverse_count?: number | null
          checked_by: string
          created_at?: string
          full_name: string
          id?: string
          nrc_number: string
          open_accounts?: number | null
          probability_of_default?: number | null
          recommendation?: string | null
          risk_level?: string | null
          score?: number | null
          score_rating?: string | null
          status?: string
          summary?: string | null
          total_outstanding_zmw?: number | null
        }
        Update: {
          adverse_count?: number | null
          checked_by?: string
          created_at?: string
          full_name?: string
          id?: string
          nrc_number?: string
          open_accounts?: number | null
          probability_of_default?: number | null
          recommendation?: string | null
          risk_level?: string | null
          score?: number | null
          score_rating?: string | null
          status?: string
          summary?: string | null
          total_outstanding_zmw?: number | null
        }
        Relationships: []
      }
      kyc: {
        Row: {
          created_at: string | null
          employee_number: string | null
          employer: string | null
          id: string
          nrc_number: string | null
          phone_number: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          employee_number?: string | null
          employer?: string | null
          id?: string
          nrc_number?: string | null
          phone_number?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          employee_number?: string | null
          employer?: string | null
          id?: string
          nrc_number?: string | null
          phone_number?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      loan_applications: {
        Row: {
          admin_notes: string | null
          consent_accepted: boolean | null
          crb_checked_at: string | null
          crb_status: string | null
          created_at: string
          credit_score: number | null
          decision: string | null
          decision_reason: string | null
          deductions: number | null
          employee_number: string | null
          employer: string | null
          estimated_monthly_repayment: number | null
          fraud_flag: boolean | null
          fraud_score: number | null
          full_name: string | null
          gov_id_number: string | null
          gov_id_type: string | null
          gross_salary: number | null
          id: string
          interest_rate: number | null
          net_salary: number | null
          nrc_number: string | null
          requested_amount: number | null
          risk_level: string | null
          selected_interest_rate: number | null
          selected_lender: string | null
          selected_repayment_months: number | null
          signature_name: string | null
          status: string
          underwriting_score: number | null
          updated_at: string
          user_id: string
          verification_notes: string | null
          verification_passed: boolean | null
        }
        Insert: {
          admin_notes?: string | null
          consent_accepted?: boolean | null
          crb_checked_at?: string | null
          crb_status?: string | null
          created_at?: string
          credit_score?: number | null
          decision?: string | null
          decision_reason?: string | null
          deductions?: number | null
          employee_number?: string | null
          employer?: string | null
          estimated_monthly_repayment?: number | null
          fraud_flag?: boolean | null
          fraud_score?: number | null
          full_name?: string | null
          gov_id_number?: string | null
          gov_id_type?: string | null
          gross_salary?: number | null
          id?: string
          interest_rate?: number | null
          net_salary?: number | null
          nrc_number?: string | null
          requested_amount?: number | null
          risk_level?: string | null
          selected_interest_rate?: number | null
          selected_lender?: string | null
          selected_repayment_months?: number | null
          signature_name?: string | null
          status?: string
          underwriting_score?: number | null
          updated_at?: string
          user_id: string
          verification_notes?: string | null
          verification_passed?: boolean | null
        }
        Update: {
          admin_notes?: string | null
          consent_accepted?: boolean | null
          crb_checked_at?: string | null
          crb_status?: string | null
          created_at?: string
          credit_score?: number | null
          decision?: string | null
          decision_reason?: string | null
          deductions?: number | null
          employee_number?: string | null
          employer?: string | null
          estimated_monthly_repayment?: number | null
          fraud_flag?: boolean | null
          fraud_score?: number | null
          full_name?: string | null
          gov_id_number?: string | null
          gov_id_type?: string | null
          gross_salary?: number | null
          id?: string
          interest_rate?: number | null
          net_salary?: number | null
          nrc_number?: string | null
          requested_amount?: number | null
          risk_level?: string | null
          selected_interest_rate?: number | null
          selected_lender?: string | null
          selected_repayment_months?: number | null
          signature_name?: string | null
          status?: string
          underwriting_score?: number | null
          updated_at?: string
          user_id?: string
          verification_notes?: string | null
          verification_passed?: boolean | null
        }
        Relationships: []
      }
      loan_results: {
        Row: {
          created_at: string
          id: string
          interest_rate: number | null
          max_limit_zmw: number | null
          user_id: string
          zmw_client_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_rate?: number | null
          max_limit_zmw?: number | null
          user_id: string
          zmw_client_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_rate?: number | null
          max_limit_zmw?: number | null
          user_id?: string
          zmw_client_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_results_zmw_client_id_fkey"
            columns: ["zmw_client_id"]
            isOneToOne: false
            referencedRelation: "underwriting_queue"
            referencedColumns: ["zmw_client_id"]
          },
        ]
      }
      notifications: {
        Row: {
          application_id: string | null
          created_at: string | null
          id: string
          message: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount_zmw: number
          created_at: string
          id: string
          lender: string
          paid_date: string | null
          period: string
          processed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_zmw?: number
          created_at?: string
          id?: string
          lender: string
          paid_date?: string | null
          period: string
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_zmw?: number
          created_at?: string
          id?: string
          lender?: string
          paid_date?: string | null
          period?: string
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_deduction_authorizations: {
        Row: {
          agreement_text: string
          agreement_version: string
          authorized_amount: number | null
          authorized_term_months: number | null
          created_at: string
          id: string
          ip_address: string | null
          loan_application_id: string | null
          revoked_at: string | null
          signature_name: string
          signed_at: string
          signer_employee_number: string | null
          signer_employer: string | null
          signer_full_name: string | null
          signer_nrc: string | null
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          agreement_text: string
          agreement_version: string
          authorized_amount?: number | null
          authorized_term_months?: number | null
          created_at?: string
          id?: string
          ip_address?: string | null
          loan_application_id?: string | null
          revoked_at?: string | null
          signature_name: string
          signed_at?: string
          signer_employee_number?: string | null
          signer_employer?: string | null
          signer_full_name?: string | null
          signer_nrc?: string | null
          status?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          agreement_text?: string
          agreement_version?: string
          authorized_amount?: number | null
          authorized_term_months?: number | null
          created_at?: string
          id?: string
          ip_address?: string | null
          loan_application_id?: string | null
          revoked_at?: string | null
          signature_name?: string
          signed_at?: string
          signer_employee_number?: string | null
          signer_employer?: string | null
          signer_full_name?: string | null
          signer_nrc?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_deduction_authorizations_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_integrations: {
        Row: {
          api_endpoint: string | null
          config: Json | null
          created_at: string
          created_by: string | null
          id: string
          provider_name: string
          status: string
          updated_at: string
        }
        Insert: {
          api_endpoint?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          provider_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          api_endpoint?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          provider_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          pricing: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          pricing?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          pricing?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          consent_accepted: boolean
          consent_signed_at: string | null
          created_at: string
          email: string | null
          employee_number: string | null
          employer: string | null
          existing_obligations: number | null
          full_name: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          ministry: string | null
          net_salary: number | null
          nrc_number: string | null
          nrc_verified: boolean
          phone: string | null
          phone_verified: boolean
          role: string | null
          salary: number | null
          updated_at: string
          user_id: string
          years_of_service: number | null
        }
        Insert: {
          account_status?: string
          consent_accepted?: boolean
          consent_signed_at?: string | null
          created_at?: string
          email?: string | null
          employee_number?: string | null
          employer?: string | null
          existing_obligations?: number | null
          full_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          ministry?: string | null
          net_salary?: number | null
          nrc_number?: string | null
          nrc_verified?: boolean
          phone?: string | null
          phone_verified?: boolean
          role?: string | null
          salary?: number | null
          updated_at?: string
          user_id: string
          years_of_service?: number | null
        }
        Update: {
          account_status?: string
          consent_accepted?: boolean
          consent_signed_at?: string | null
          created_at?: string
          email?: string | null
          employee_number?: string | null
          employer?: string | null
          existing_obligations?: number | null
          full_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          ministry?: string | null
          net_salary?: number | null
          nrc_number?: string | null
          nrc_verified?: boolean
          phone?: string | null
          phone_verified?: boolean
          role?: string | null
          salary?: number | null
          updated_at?: string
          user_id?: string
          years_of_service?: number | null
        }
        Relationships: []
      }
      risk_flags: {
        Row: {
          application_id: string
          created_at: string
          flag_type: string
          flags: Json | null
          fraud_score: number | null
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          flag_type: string
          flags?: Json | null
          fraud_score?: number | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          flag_type?: string
          flags?: Json | null
          fraud_score?: number | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      underwriting_queue: {
        Row: {
          created_at: string
          debt_zmw: number
          id: string
          income_zmw: number
          score_result: number | null
          status: string
          updated_at: string
          user_id: string
          zmw_client_id: string
        }
        Insert: {
          created_at?: string
          debt_zmw: number
          id?: string
          income_zmw: number
          score_result?: number | null
          status?: string
          updated_at?: string
          user_id: string
          zmw_client_id: string
        }
        Update: {
          created_at?: string
          debt_zmw?: number
          id?: string
          income_zmw?: number
          score_result?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          zmw_client_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_zmw_underwriting: {
        Args: { p_debt: number; p_income: number }
        Returns: {
          calculated_score: number
          max_limit: number
        }[]
      }
      check_connection: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _new_value?: Json
          _old_value?: Json
          _record_id?: string
          _role: string
          _table_name?: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "super_admin"
        | "super_user"
        | "compliance_team"
        | "data_entry_team"
      kyc_status:
        | "PENDING"
        | "IN_REVIEW"
        | "COMPLETED"
        | "REJECTED"
        | "VERIFIED"
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
      app_role: [
        "admin",
        "user",
        "super_admin",
        "super_user",
        "compliance_team",
        "data_entry_team",
      ],
      kyc_status: ["PENDING", "IN_REVIEW", "COMPLETED", "REJECTED", "VERIFIED"],
    },
  },
} as const
