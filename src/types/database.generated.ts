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
      ai_config: {
        Row: {
          active_model: string
          active_provider: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_model: string
          active_provider: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_model?: string
          active_provider?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_config_updated_by_profiles_id_fk"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_menu_suggestions: {
        Row: {
          generated_at: string
          generated_by: string
          generated_text: string | null
          id: string
          latency_ms: number | null
          model: string
          prompt_version: string
          provider: string
          raw_response: Json | null
          status: Database["public"]["Enums"]["ai_suggestion_status"]
          treatment_id: string
        }
        Insert: {
          generated_at?: string
          generated_by: string
          generated_text?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          prompt_version: string
          provider: string
          raw_response?: Json | null
          status: Database["public"]["Enums"]["ai_suggestion_status"]
          treatment_id: string
        }
        Update: {
          generated_at?: string
          generated_by?: string
          generated_text?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          prompt_version?: string
          provider?: string
          raw_response?: Json | null
          status?: Database["public"]["Enums"]["ai_suggestion_status"]
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_menu_suggestions_generated_by_profiles_id_fk"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_menu_suggestions_treatment_id_treatments_id_fk"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          prompt_key: string
          status: string
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_key: string
          status?: string
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_key?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompts_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bis_import_logs: {
        Row: {
          created_at: string
          error_detail: string | null
          evaluation_id: string | null
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          error_detail?: string | null
          evaluation_id?: string | null
          id?: string
          status: string
        }
        Update: {
          created_at?: string
          error_detail?: string | null
          evaluation_id?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bis_import_logs_evaluation_id_evaluations_id_fk"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      bis_measurements: {
        Row: {
          created_at: string
          device_calibration_date: string | null
          device_id: string | null
          evaluation_id: string
          id: string
          measurement_date: string
        }
        Insert: {
          created_at?: string
          device_calibration_date?: string | null
          device_id?: string | null
          evaluation_id: string
          id?: string
          measurement_date: string
        }
        Update: {
          created_at?: string
          device_calibration_date?: string | null
          device_id?: string | null
          evaluation_id?: string
          id?: string
          measurement_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bis_measurements_device_id_devices_id_fk"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bis_measurements_evaluation_id_evaluations_id_fk"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      bis_raw_values: {
        Row: {
          id: string
          measurement_id: string
          value: number
          variable_name: string
        }
        Insert: {
          id?: string
          measurement_id: string
          value: number
          variable_name: string
        }
        Update: {
          id?: string
          measurement_id?: string
          value?: number
          variable_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bis_raw_values_measurement_id_bis_measurements_id_fk"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "bis_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      bis_variables: {
        Row: {
          description: string | null
          id: string
          name: string
          unit: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          unit?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          unit?: string | null
        }
        Relationships: []
      }
      clinical_audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event: string
          id: string
          ip_address: unknown
          model_version_id: string | null
          payload: Json | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event: string
          id?: string
          ip_address?: unknown
          model_version_id?: string | null
          payload?: Json | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event?: string
          id?: string
          ip_address?: unknown
          model_version_id?: string | null
          payload?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_audit_log_actor_id_profiles_id_fk"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_audit_log_model_version_id_model_versions_id_fk"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cnv_revenue: {
        Row: {
          amount: number
          created_at: string
          id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cnv_revenue_transaction_id_transactions_id_fk"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      device_assignments: {
        Row: {
          actual_return_date: string | null
          created_at: string
          device_id: string
          expected_end_date: string
          id: string
          legal_document_url: string | null
          professional_id: string
          start_date: string
          status: Database["public"]["Enums"]["assignment_status"]
        }
        Insert: {
          actual_return_date?: string | null
          created_at?: string
          device_id: string
          expected_end_date: string
          id?: string
          legal_document_url?: string | null
          professional_id: string
          start_date: string
          status?: Database["public"]["Enums"]["assignment_status"]
        }
        Update: {
          actual_return_date?: string | null
          created_at?: string
          device_id?: string
          expected_end_date?: string
          id?: string
          legal_document_url?: string | null
          professional_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["assignment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "device_assignments_device_id_devices_id_fk"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_assignments_professional_id_professional_profiles_id_fk"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          asset_code: string
          brand: string | null
          created_at: string
          id: string
          last_calibration_date: string | null
          manufacturer_serial: string
          model: string
          organization_id: string
          purchase_date: string | null
          status: Database["public"]["Enums"]["device_status"]
          supplier: string | null
          system_email: string
          updated_at: string
        }
        Insert: {
          asset_code: string
          brand?: string | null
          created_at?: string
          id?: string
          last_calibration_date?: string | null
          manufacturer_serial: string
          model: string
          organization_id: string
          purchase_date?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          supplier?: string | null
          system_email: string
          updated_at?: string
        }
        Update: {
          asset_code?: string
          brand?: string | null
          created_at?: string
          id?: string
          last_calibration_date?: string | null
          manufacturer_serial?: string
          model?: string
          organization_id?: string
          purchase_date?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          supplier?: string | null
          system_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnoses: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          diagnosis_name: string
          efr_state_number: number
          engine_version: string
          evaluation_id: string
          fr_sector_id: string | null
          id: string
          model_version_id: string
          phenotype_id: string | null
          rules_version: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          diagnosis_name: string
          efr_state_number: number
          engine_version: string
          evaluation_id: string
          fr_sector_id?: string | null
          id?: string
          model_version_id: string
          phenotype_id?: string | null
          rules_version: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          diagnosis_name?: string
          efr_state_number?: number
          engine_version?: string
          evaluation_id?: string
          fr_sector_id?: string | null
          id?: string
          model_version_id?: string
          phenotype_id?: string | null
          rules_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnoses_confirmed_by_profiles_id_fk"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_evaluation_id_evaluations_id_fk"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_fr_sector_id_fr_sectors_id_fk"
            columns: ["fr_sector_id"]
            isOneToOne: false
            referencedRelation: "fr_sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_model_version_id_model_versions_id_fk"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_phenotype_id_phenotypes_id_fk"
            columns: ["phenotype_id"]
            isOneToOne: false
            referencedRelation: "phenotypes"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosis_notes: {
        Row: {
          created_at: string
          diagnosis_id: string
          id: string
          note: string
        }
        Insert: {
          created_at?: string
          diagnosis_id: string
          id?: string
          note: string
        }
        Update: {
          created_at?: string
          diagnosis_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_notes_diagnosis_id_diagnoses_id_fk"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
        ]
      }
      efr_states: {
        Row: {
          biomarkers: string | null
          diagnosis_name: string
          ffmi_band: number
          fmi_band: number
          id: string
          ifc_band: number
          irc_band: number
          mechanism: string | null
          model_version_id: string
          risks: string | null
          state_number: number
          suggested_nutraceuticals: string | null
        }
        Insert: {
          biomarkers?: string | null
          diagnosis_name: string
          ffmi_band: number
          fmi_band: number
          id?: string
          ifc_band: number
          irc_band: number
          mechanism?: string | null
          model_version_id: string
          risks?: string | null
          state_number: number
          suggested_nutraceuticals?: string | null
        }
        Update: {
          biomarkers?: string | null
          diagnosis_name?: string
          ffmi_band?: number
          fmi_band?: number
          id?: string
          ifc_band?: number
          irc_band?: number
          mechanism?: string | null
          model_version_id?: string
          risks?: string | null
          state_number?: number
          suggested_nutraceuticals?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "efr_states_model_version_id_model_versions_id_fk"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_notes: {
        Row: {
          author_id: string
          created_at: string
          evaluation_id: string
          id: string
          note: string
        }
        Insert: {
          author_id: string
          created_at?: string
          evaluation_id: string
          id?: string
          note: string
        }
        Update: {
          author_id?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_notes_author_id_profiles_id_fk"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_notes_evaluation_id_evaluations_id_fk"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          patient_id: string
          professional_id: string
          status: Database["public"]["Enums"]["evaluation_status"]
          type: Database["public"]["Enums"]["evaluation_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          patient_id: string
          professional_id: string
          status?: Database["public"]["Enums"]["evaluation_status"]
          type: Database["public"]["Enums"]["evaluation_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          patient_id?: string
          professional_id?: string
          status?: Database["public"]["Enums"]["evaluation_status"]
          type?: Database["public"]["Enums"]["evaluation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_professional_id_professional_profiles_id_fk"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_metrics: {
        Row: {
          followup_id: string
          id: string
          metric_name: string
          value: number | null
        }
        Insert: {
          followup_id: string
          id?: string
          metric_name: string
          value?: number | null
        }
        Update: {
          followup_id?: string
          id?: string
          metric_name?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_metrics_followup_id_followups_id_fk"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "followups"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          created_at: string
          evaluation_id: string | null
          followup_date: string
          id: string
          patient_id: string
          treatment_id: string | null
        }
        Insert: {
          created_at?: string
          evaluation_id?: string | null
          followup_date?: string
          id?: string
          patient_id: string
          treatment_id?: string | null
        }
        Update: {
          created_at?: string
          evaluation_id?: string | null
          followup_date?: string
          id?: string
          patient_id?: string
          treatment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followups_evaluation_id_evaluations_id_fk"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_treatment_id_treatments_id_fk"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      fr_sectors: {
        Row: {
          code: string
          id: string
          model_version_id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          model_version_id: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          model_version_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fr_sectors_model_version_id_model_versions_id_fk"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_definitions: {
        Row: {
          code: string
          description: string | null
          id: string
          model_version_id: string
          name: string
          unit: string | null
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          model_version_id: string
          name: string
          unit?: string | null
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          model_version_id?: string
          name?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_definitions_model_version_id_model_versions_id_fk"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_ranges: {
        Row: {
          classification: Database["public"]["Enums"]["indicator_classification"]
          id: string
          indicator_definition_id: string
          max_value: number | null
          min_value: number | null
        }
        Insert: {
          classification: Database["public"]["Enums"]["indicator_classification"]
          id?: string
          indicator_definition_id: string
          max_value?: number | null
          min_value?: number | null
        }
        Update: {
          classification?: Database["public"]["Enums"]["indicator_classification"]
          id?: string
          indicator_definition_id?: string
          max_value?: number | null
          min_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_ranges_indicator_definition_id_indicator_definitions_"
            columns: ["indicator_definition_id"]
            isOneToOne: false
            referencedRelation: "indicator_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_values: {
        Row: {
          classification:
            | Database["public"]["Enums"]["indicator_classification"]
            | null
          created_at: string
          engine_version: string
          evaluation_id: string
          id: string
          indicator_definition_id: string
          model_version_id: string
          rules_version: string
          survey_version_id: string
          value: number | null
        }
        Insert: {
          classification?:
            | Database["public"]["Enums"]["indicator_classification"]
            | null
          created_at?: string
          engine_version: string
          evaluation_id: string
          id?: string
          indicator_definition_id: string
          model_version_id: string
          rules_version: string
          survey_version_id: string
          value?: number | null
        }
        Update: {
          classification?:
            | Database["public"]["Enums"]["indicator_classification"]
            | null
          created_at?: string
          engine_version?: string
          evaluation_id?: string
          id?: string
          indicator_definition_id?: string
          model_version_id?: string
          rules_version?: string
          survey_version_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_values_evaluation_id_evaluations_id_fk"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_values_indicator_definition_id_indicator_definitions_"
            columns: ["indicator_definition_id"]
            isOneToOne: false
            referencedRelation: "indicator_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_values_model_version_id_model_versions_id_fk"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_values_survey_version_id_survey_versions_id_fk"
            columns: ["survey_version_id"]
            isOneToOne: false
            referencedRelation: "survey_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      model_variables: {
        Row: {
          description: string | null
          id: string
          model_version_id: string
          variable_name: string
        }
        Insert: {
          description?: string | null
          id?: string
          model_version_id: string
          variable_name: string
        }
        Update: {
          description?: string | null
          id?: string
          model_version_id?: string
          variable_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_variables_model_version_id_model_versions_id_fk"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          rules_version: string
          status: Database["public"]["Enums"]["model_status"]
          version_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          rules_version: string
          status?: Database["public"]["Enums"]["model_status"]
          version_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          rules_version?: string
          status?: Database["public"]["Enums"]["model_status"]
          version_name?: string
        }
        Relationships: []
      }
      nutraceutical_inventory: {
        Row: {
          id: string
          last_updated: string
          nutraceutical_id: string
          stock_quantity: number
        }
        Insert: {
          id?: string
          last_updated?: string
          nutraceutical_id: string
          stock_quantity?: number
        }
        Update: {
          id?: string
          last_updated?: string
          nutraceutical_id?: string
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutraceutical_inventory_nutraceutical_id_nutraceuticals_id_fk"
            columns: ["nutraceutical_id"]
            isOneToOne: false
            referencedRelation: "nutraceuticals"
            referencedColumns: ["id"]
          },
        ]
      }
      nutraceutical_usage: {
        Row: {
          id: string
          nutraceutical_id: string
          quantity: number
          treatment_id: string
        }
        Insert: {
          id?: string
          nutraceutical_id: string
          quantity: number
          treatment_id: string
        }
        Update: {
          id?: string
          nutraceutical_id?: string
          quantity?: number
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutraceutical_usage_nutraceutical_id_nutraceuticals_id_fk"
            columns: ["nutraceutical_id"]
            isOneToOne: false
            referencedRelation: "nutraceuticals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutraceutical_usage_treatment_id_treatments_id_fk"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      nutraceuticals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutraceuticals_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type_enum"]
          consent_version: string
          document_hash: string
          id: string
          legal_representative_document: string | null
          legal_representative_email: string | null
          legal_representative_name: string | null
          legal_representative_relationship: string | null
          patient_id: string
          revoked_at: string | null
          signed_at: string
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type_enum"]
          consent_version: string
          document_hash: string
          id?: string
          legal_representative_document?: string | null
          legal_representative_email?: string | null
          legal_representative_name?: string | null
          legal_representative_relationship?: string | null
          patient_id: string
          revoked_at?: string | null
          signed_at?: string
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type_enum"]
          consent_version?: string
          document_hash?: string
          id?: string
          legal_representative_document?: string | null
          legal_representative_email?: string | null
          legal_representative_name?: string | null
          legal_representative_relationship?: string | null
          patient_id?: string
          revoked_at?: string | null
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_contacts: {
        Row: {
          created_at: string
          email: string | null
          patient_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          patient_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          patient_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_contacts_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_professional_relationships: {
        Row: {
          assigned_at: string
          id: string
          patient_id: string
          professional_id: string
          status: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          patient_id: string
          professional_id: string
          status?: string
        }
        Update: {
          assigned_at?: string
          id?: string
          patient_id?: string
          professional_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_professional_relationships_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_professional_relationships_professional_id_professional"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_profiles: {
        Row: {
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string
          first_name: string
          last_name: string
          patient_id: string
          sex: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          first_name: string
          last_name: string
          patient_id: string
          sex?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          first_name?: string
          last_name?: string
          patient_id?: string
          sex?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_profiles_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          deleted_at: string | null
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["patient_status"]
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["patient_status"]
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          document_number?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["patient_status"]
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          external_id: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      phenotypes: {
        Row: {
          code: string
          id: string
          model_version_id: string
          name: string
          risk: string | null
        }
        Insert: {
          code: string
          id?: string
          model_version_id: string
          name: string
          risk?: string | null
        }
        Update: {
          code?: string
          id?: string
          model_version_id?: string
          name?: string
          risk?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phenotypes_model_version_id_model_versions_id_fk"
            columns: ["model_version_id"]
            isOneToOne: false
            referencedRelation: "model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_certifications: {
        Row: {
          certification_name: string
          created_at: string
          id: string
          institution: string | null
          professional_id: string
          year: number | null
        }
        Insert: {
          certification_name: string
          created_at?: string
          id?: string
          institution?: string | null
          professional_id: string
          year?: number | null
        }
        Update: {
          certification_name?: string
          created_at?: string
          id?: string
          institution?: string | null
          professional_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_certifications_professional_id_professional_profil"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_profiles: {
        Row: {
          certification_status: string | null
          commission_rate: number
          created_at: string
          id: string
          license: string | null
          profile_id: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          certification_status?: string | null
          commission_rate?: number
          created_at?: string
          id?: string
          license?: string | null
          profile_id: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          certification_status?: string | null
          commission_rate?: number
          created_at?: string
          id?: string
          license?: string | null
          profile_id?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_profiles_profile_id_profiles_id_fk"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_revenue: {
        Row: {
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          professional_id: string
          transaction_id: string
        }
        Insert: {
          commission_amount: number
          commission_rate: number
          created_at?: string
          id?: string
          professional_id: string
          transaction_id: string
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          professional_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_revenue_professional_id_professional_profiles_id_f"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_revenue_transaction_id_transactions_id_fk"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          organization_id: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          evaluation_id: string
          id: string
          patient_id: string
          professional_notes: string | null
          send_mode: string | null
          sent_at: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["report_status"]
          storage_path: string | null
          type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          evaluation_id: string
          id?: string
          patient_id: string
          professional_notes?: string | null
          send_mode?: string | null
          sent_at?: string | null
          snapshot: Json
          status?: Database["public"]["Enums"]["report_status"]
          storage_path?: string | null
          type: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          evaluation_id?: string
          id?: string
          patient_id?: string
          professional_notes?: string | null
          send_mode?: string | null
          sent_at?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_status"]
          storage_path?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_approved_by_profiles_id_fk"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_evaluation_id_evaluations_id_fk"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      research_datasets: {
        Row: {
          anonymization_level: string
          created_at: string
          id: string
          requested_by: string
          scope: string
          status: string
        }
        Insert: {
          anonymization_level: string
          created_at?: string
          id?: string
          requested_by: string
          scope: string
          status?: string
        }
        Update: {
          anonymization_level?: string
          created_at?: string
          id?: string
          requested_by?: string
          scope?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_datasets_requested_by_profiles_id_fk"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string | null
          id: string
          name: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          description?: string | null
          id?: string
          name: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          description?: string | null
          id?: string
          name?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      survey_answers: {
        Row: {
          answer_value: string | null
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_value?: string | null
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_value?: string | null
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_question_id_survey_questions_id_fk"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_response_id_survey_responses_id_fk"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_links: {
        Row: {
          consumed_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          organization_id: string
          patient_id: string | null
          prefill: Json | null
          professional_id: string
          token: string
          type: Database["public"]["Enums"]["evaluation_type"]
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          organization_id: string
          patient_id?: string | null
          prefill?: Json | null
          professional_id: string
          token: string
          type: Database["public"]["Enums"]["evaluation_type"]
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          organization_id?: string
          patient_id?: string | null
          prefill?: Json | null
          professional_id?: string
          token?: string
          type?: Database["public"]["Enums"]["evaluation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "survey_links_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_links_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_links_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_links_professional_id_professional_profiles_id_fk"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_options: {
        Row: {
          id: string
          option_text: string
          order_index: number
          question_id: string
          value: number | null
        }
        Insert: {
          id?: string
          option_text: string
          order_index: number
          question_id: string
          value?: number | null
        }
        Update: {
          id?: string
          option_text?: string
          order_index?: number
          question_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_options_question_id_survey_questions_id_fk"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          data_class: Database["public"]["Enums"]["field_data_class"]
          field_key: string | null
          id: string
          order_index: number
          question_text: string
          question_type: string
          section: string | null
          survey_version_id: string
          used_in_diagnosis: boolean
        }
        Insert: {
          data_class: Database["public"]["Enums"]["field_data_class"]
          field_key?: string | null
          id?: string
          order_index: number
          question_text: string
          question_type: string
          section?: string | null
          survey_version_id: string
          used_in_diagnosis?: boolean
        }
        Update: {
          data_class?: Database["public"]["Enums"]["field_data_class"]
          field_key?: string | null
          id?: string
          order_index?: number
          question_text?: string
          question_type?: string
          section?: string | null
          survey_version_id?: string
          used_in_diagnosis?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_version_id_survey_versions_id_fk"
            columns: ["survey_version_id"]
            isOneToOne: false
            referencedRelation: "survey_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          ip_address: unknown
          survey_version_id: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          ip_address?: unknown
          survey_version_id: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          ip_address?: unknown
          survey_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_evaluation_id_evaluations_id_fk"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_version_id_survey_versions_id_fk"
            columns: ["survey_version_id"]
            isOneToOne: false
            referencedRelation: "survey_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      survey_versions: {
        Row: {
          id: string
          published_at: string
          template_id: string
          version_number: number
        }
        Insert: {
          id?: string
          published_at?: string
          template_id: string
          version_number: number
        }
        Update: {
          id?: string
          published_at?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "survey_versions_template_id_survey_templates_id_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          id: string
          nutraceutical_id: string
          quantity: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          nutraceutical_id: string
          quantity: number
          transaction_id: string
          unit_price: number
        }
        Update: {
          id?: string
          nutraceutical_id?: string
          quantity?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_nutraceutical_id_nutraceuticals_id_fk"
            columns: ["nutraceutical_id"]
            isOneToOne: false
            referencedRelation: "nutraceuticals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_transactions_id_fk"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          alegra_invoice_id: string | null
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          organization_id: string
          patient_id: string | null
          professional_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
          wompi_transaction_id: string | null
        }
        Insert: {
          alegra_invoice_id?: string | null
          amount: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          organization_id: string
          patient_id?: string | null
          professional_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          wompi_transaction_id?: string | null
        }
        Update: {
          alegra_invoice_id?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          patient_id?: string | null
          professional_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          wompi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_organization_id_organizations_id_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_patient_id_patients_id_fk"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_professional_id_professional_profiles_id_fk"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_diet_guidelines: {
        Row: {
          guideline_text: string
          id: string
          treatment_id: string
        }
        Insert: {
          guideline_text: string
          id?: string
          treatment_id: string
        }
        Update: {
          guideline_text?: string
          id?: string
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_diet_guidelines_treatment_id_treatments_id_fk"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          treatment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          treatment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_notes_treatment_id_treatments_id_fk"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_nutraceuticals: {
        Row: {
          dosage: string | null
          duration_days: number | null
          id: string
          nutraceutical_id: string
          treatment_id: string
        }
        Insert: {
          dosage?: string | null
          duration_days?: number | null
          id?: string
          nutraceutical_id: string
          treatment_id: string
        }
        Update: {
          dosage?: string | null
          duration_days?: number | null
          id?: string
          nutraceutical_id?: string
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_nutraceuticals_nutraceutical_id_nutraceuticals_id_fk"
            columns: ["nutraceutical_id"]
            isOneToOne: false
            referencedRelation: "nutraceuticals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_nutraceuticals_treatment_id_treatments_id_fk"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          created_at: string
          created_by: string
          diagnosis_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          diagnosis_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          diagnosis_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_diagnosis_id_diagnoses_id_fk"
            columns: ["diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_roles_id_fk"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_patient_professional: {
        Args: { p_patient_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ai_suggestion_status:
        | "success"
        | "timeout"
        | "parse_failed"
        | "provider_error"
      app_role: "admin" | "direccion" | "soporte" | "obbia" | "professional"
      assignment_status: "active" | "completed" | "breach"
      consent_type_enum:
        | "servicio"
        | "datos_sensibles"
        | "internacional_ia"
        | "investigacion"
        | "comunicaciones_continuidad"
        | "comunicaciones_comerciales"
        | "representante_legal"
        | "asentimiento_menor"
      device_status:
        | "available"
        | "in_use"
        | "maintenance"
        | "out_of_service"
        | "lost"
        | "retired"
      document_type: "CC" | "CE" | "TI" | "PA" | "NIT"
      evaluation_status: "draft" | "in_progress" | "completed"
      evaluation_type: "inicial" | "seguimiento"
      field_data_class: "identifier" | "quasi_identifier" | "clinical"
      indicator_classification: "normal" | "riesgo" | "critico"
      model_status: "draft" | "active" | "retired"
      patient_status: "active" | "inactive"
      profile_status: "active" | "inactive"
      report_status: "draft" | "approved" | "sent"
      transaction_status: "pending" | "paid" | "failed" | "refunded"
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
      ai_suggestion_status: [
        "success",
        "timeout",
        "parse_failed",
        "provider_error",
      ],
      app_role: ["admin", "direccion", "soporte", "obbia", "professional"],
      assignment_status: ["active", "completed", "breach"],
      consent_type_enum: [
        "servicio",
        "datos_sensibles",
        "internacional_ia",
        "investigacion",
        "comunicaciones_continuidad",
        "comunicaciones_comerciales",
        "representante_legal",
        "asentimiento_menor",
      ],
      device_status: [
        "available",
        "in_use",
        "maintenance",
        "out_of_service",
        "lost",
        "retired",
      ],
      document_type: ["CC", "CE", "TI", "PA", "NIT"],
      evaluation_status: ["draft", "in_progress", "completed"],
      evaluation_type: ["inicial", "seguimiento"],
      field_data_class: ["identifier", "quasi_identifier", "clinical"],
      indicator_classification: ["normal", "riesgo", "critico"],
      model_status: ["draft", "active", "retired"],
      patient_status: ["active", "inactive"],
      profile_status: ["active", "inactive"],
      report_status: ["draft", "approved", "sent"],
      transaction_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const

