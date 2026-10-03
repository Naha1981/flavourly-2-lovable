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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      approval_requests: {
        Row: {
          id: string
          message_text: string
          outbox_job_id: string
          reason: string
          recipient_phone: string
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          risk_level: string
          status: string
          tenant_id: string
        }
        Insert: {
          id?: string
          message_text: string
          outbox_job_id: string
          reason: string
          recipient_phone: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          risk_level: string
          status?: string
          tenant_id: string
        }
        Update: {
          id?: string
          message_text?: string
          outbox_job_id?: string
          reason?: string
          recipient_phone?: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          risk_level?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_outbox_job_id_fkey"
            columns: ["outbox_job_id"]
            isOneToOne: true
            referencedRelation: "outbox_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_drafts: {
        Row: {
          booking_date: string | null
          booking_time: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string
          expires_at: string
          id: string
          party_size: number | null
          special_requests: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booking_date?: string | null
          booking_time?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          expires_at: string
          id?: string
          party_size?: number | null
          special_requests?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booking_date?: string | null
          booking_time?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          expires_at?: string
          id?: string
          party_size?: number | null
          special_requests?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          message_a: string
          message_b: string | null
          name: string
          segment: string
          sent_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_a: string
          message_b?: string | null
          name: string
          segment: string
          sent_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_a?: string
          message_b?: string | null
          name?: string
          segment?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          birthday: string | null
          created_at: string
          id: string
          is_vip: boolean
          last_birthday_reward_sent_at: string | null
          last_reactivation_sent_at: string | null
          last_visit_at: string | null
          name: string | null
          phone: string
          preferences: Json
          tenant_id: string
          total_spend_cents: number
          visit_count: number
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          id?: string
          is_vip?: boolean
          last_birthday_reward_sent_at?: string | null
          last_reactivation_sent_at?: string | null
          last_visit_at?: string | null
          name?: string | null
          phone: string
          preferences?: Json
          tenant_id: string
          total_spend_cents?: number
          visit_count?: number
        }
        Update: {
          birthday?: string | null
          created_at?: string
          id?: string
          is_vip?: boolean
          last_birthday_reward_sent_at?: string | null
          last_reactivation_sent_at?: string | null
          last_visit_at?: string | null
          name?: string | null
          phone?: string
          preferences?: Json
          tenant_id?: string
          total_spend_cents?: number
          visit_count?: number
        }
        Relationships: []
      }
      feedback_requests: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          incident_id: string | null
          rating: number | null
          reservation_id: string
          state: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          incident_id?: string | null
          rating?: number | null
          reservation_id: string
          state?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          incident_id?: string | null
          rating?: number | null
          reservation_id?: string
          state?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_ledger: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          idempotency_key: string
          metadata: Json
          points_change: number
          reason: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          idempotency_key: string
          metadata?: Json
          points_change: number
          reason: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          points_change?: number
          reason?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: []
      }
      menu_item_pairings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          paired_item_id: string
          pairing_type: string
          pitch_copy: string | null
          source_item_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          paired_item_id: string
          pairing_type?: string
          pitch_copy?: string | null
          source_item_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          paired_item_id?: string
          pairing_type?: string
          pitch_copy?: string | null
          source_item_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_pairings_paired_item_id_fkey"
            columns: ["paired_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_pairings_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          cost_price_cents: number | null
          created_at: string
          description: string | null
          dietary_flags: string[]
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price_cents: number
          sales_count_30d: number
          tenant_id: string
        }
        Insert: {
          category_id?: string | null
          cost_price_cents?: number | null
          created_at?: string
          description?: string | null
          dietary_flags?: string[]
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price_cents: number
          sales_count_30d?: number
          tenant_id: string
        }
        Update: {
          category_id?: string | null
          cost_price_cents?: number | null
          created_at?: string
          description?: string | null
          dietary_flags?: string[]
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price_cents?: number
          sales_count_30d?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_jobs: {
        Row: {
          attempts: number
          automated: boolean
          campaign_id: string | null
          conversation_id: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          message_text: string
          recipient_phone: string
          scheduled_for: string
          sent_at: string | null
          status: string
          tenant_id: string
          variant: string | null
        }
        Insert: {
          attempts?: number
          automated?: boolean
          campaign_id?: string | null
          conversation_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          message_text: string
          recipient_phone: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          variant?: string | null
        }
        Update: {
          attempts?: number
          automated?: boolean
          campaign_id?: string | null
          conversation_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          message_text?: string
          recipient_phone?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbox_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_incidents: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string
          feedback_text: string | null
          id: string
          rating: number
          recovery_voucher_cents: number | null
          recovery_voucher_code: string | null
          recovery_voucher_used_at: string | null
          resolution_status: string
          resolved_at: string | null
          tenant_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          feedback_text?: string | null
          id?: string
          rating: number
          recovery_voucher_cents?: number | null
          recovery_voucher_code?: string | null
          recovery_voucher_used_at?: string | null
          resolution_status?: string
          resolved_at?: string | null
          tenant_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          feedback_text?: string | null
          id?: string
          rating?: number
          recovery_voucher_cents?: number | null
          recovery_voucher_code?: string | null
          recovery_voucher_used_at?: string | null
          resolution_status?: string
          resolved_at?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          attendance_confirmed_at: string | null
          created_at: string
          customer_confirmed_at: string | null
          customer_name: string
          customer_phone: string
          id: string
          party_size: number
          reservation_date: string
          reservation_time: string
          source_draft_id: string | null
          special_requests: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          attendance_confirmed_at?: string | null
          created_at?: string
          customer_confirmed_at?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          party_size: number
          reservation_date: string
          reservation_time: string
          source_draft_id?: string | null
          special_requests?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          attendance_confirmed_at?: string | null
          created_at?: string
          customer_confirmed_at?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          party_size?: number
          reservation_date?: string
          reservation_time?: string
          source_draft_id?: string | null
          special_requests?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_source_draft_id_fkey"
            columns: ["source_draft_id"]
            isOneToOne: true
            referencedRelation: "booking_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_claims: {
        Row: {
          client_lat: number | null
          client_lon: number | null
          created_at: string
          customer_id: string
          discount_cents: number
          distance_meters: number | null
          expires_at: string
          id: string
          points_to_burn: number
          redeemed_at: string | null
          status: string
          tenant_id: string
          token: string
          voucher_code: string | null
          voucher_used_at: string | null
        }
        Insert: {
          client_lat?: number | null
          client_lon?: number | null
          created_at?: string
          customer_id: string
          discount_cents: number
          distance_meters?: number | null
          expires_at: string
          id?: string
          points_to_burn: number
          redeemed_at?: string | null
          status?: string
          tenant_id: string
          token: string
          voucher_code?: string | null
          voucher_used_at?: string | null
        }
        Update: {
          client_lat?: number | null
          client_lon?: number | null
          created_at?: string
          customer_id?: string
          discount_cents?: number
          distance_meters?: number | null
          expires_at?: string
          id?: string
          points_to_burn?: number
          redeemed_at?: string | null
          status?: string
          tenant_id?: string
          token?: string
          voucher_code?: string | null
          voucher_used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          caption: string
          created_at: string
          error: string | null
          id: string
          media_urls: Json
          openpost_post_id: string | null
          scheduled_for: string | null
          status: string
          target_platforms: Json
          tenant_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          caption: string
          created_at?: string
          error?: string | null
          id?: string
          media_urls?: Json
          openpost_post_id?: string | null
          scheduled_for?: string | null
          status?: string
          target_platforms?: Json
          tenant_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          caption?: string
          created_at?: string
          error?: string | null
          id?: string
          media_urls?: Json
          openpost_post_id?: string | null
          scheduled_for?: string | null
          status?: string
          target_platforms?: Json
          tenant_id?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          created_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_profiles: {
        Row: {
          auto_replies_enabled: boolean
          average_check_cents: number | null
          city: string | null
          created_at: string
          cuisine: string | null
          geofence_radius_m: number
          google_review_url: string | null
          hours: string | null
          latitude: number | null
          longitude: number | null
          manager_phone: string | null
          name: string
          notes: string | null
          owner_name: string | null
          tenant_id: string
          timezone: string
          wa_account_id: string | null
          wa_operator_tenant_token: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          auto_replies_enabled?: boolean
          average_check_cents?: number | null
          city?: string | null
          created_at?: string
          cuisine?: string | null
          geofence_radius_m?: number
          google_review_url?: string | null
          hours?: string | null
          latitude?: number | null
          longitude?: number | null
          manager_phone?: string | null
          name: string
          notes?: string | null
          owner_name?: string | null
          tenant_id: string
          timezone?: string
          wa_account_id?: string | null
          wa_operator_tenant_token?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          auto_replies_enabled?: boolean
          average_check_cents?: number | null
          city?: string | null
          created_at?: string
          cuisine?: string | null
          geofence_radius_m?: number
          google_review_url?: string | null
          hours?: string | null
          latitude?: number | null
          longitude?: number | null
          manager_phone?: string | null
          name?: string
          notes?: string | null
          owner_name?: string | null
          tenant_id?: string
          timezone?: string
          wa_account_id?: string | null
          wa_operator_tenant_token?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      wa_conversations: {
        Row: {
          assignee: string | null
          chat_id: string
          created_at: string
          guest_name: string | null
          guest_phone: string | null
          id: string
          intent: string
          last_message: string | null
          last_message_at: string
          next_action: string | null
          preferences: Json | null
          sentiment: string | null
          status: string
          summary: string | null
          tenant_id: string
          unread: number
          urgency: string
        }
        Insert: {
          assignee?: string | null
          chat_id: string
          created_at?: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          intent?: string
          last_message?: string | null
          last_message_at?: string
          next_action?: string | null
          preferences?: Json | null
          sentiment?: string | null
          status?: string
          summary?: string | null
          tenant_id: string
          unread?: number
          urgency?: string
        }
        Update: {
          assignee?: string | null
          chat_id?: string
          created_at?: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          intent?: string
          last_message?: string | null
          last_message_at?: string
          next_action?: string | null
          preferences?: Json | null
          sentiment?: string | null
          status?: string
          summary?: string | null
          tenant_id?: string
          unread?: number
          urgency?: string
        }
        Relationships: []
      }
      wa_messages: {
        Row: {
          body: string
          conversation_id: string
          direction: string
          id: string
          sent_at: string
          tenant_id: string
          wa_message_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          direction?: string
          id?: string
          sent_at?: string
          tenant_id: string
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          direction?: string
          id?: string
          sent_at?: string
          tenant_id?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_webhook_events: {
        Row: {
          error: string | null
          event_count: number
          id: string
          last_retry_at: string | null
          raw_body: string | null
          received_at: string
          retry_count: number
          saved: number
          status: string
          tenant_id: string | null
        }
        Insert: {
          error?: string | null
          event_count?: number
          id?: string
          last_retry_at?: string | null
          raw_body?: string | null
          received_at?: string
          retry_count?: number
          saved?: number
          status?: string
          tenant_id?: string | null
        }
        Update: {
          error?: string | null
          event_count?: number
          id?: string
          last_retry_at?: string | null
          raw_body?: string | null
          received_at?: string
          retry_count?: number
          saved?: number
          status?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          offer_expires_at: string | null
          offer_reservation_id: string | null
          party_size: number
          requested_date: string
          requested_time: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          offer_expires_at?: string | null
          offer_reservation_id?: string | null
          party_size: number
          requested_date: string
          requested_time?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          offer_expires_at?: string | null
          offer_reservation_id?: string | null
          party_size?: number
          requested_date?: string
          requested_time?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_offer_reservation_id_fkey"
            columns: ["offer_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_points: {
        Args: {
          p_customer: string
          p_key: string
          p_meta?: Json
          p_points: number
          p_reason: string
          p_tenant: string
        }
        Returns: boolean
      }
      claim_waitlist_offer: {
        Args: {
          p_date: string
          p_party_size: number
          p_reservation_id: string
          p_tenant: string
          p_ttl_minutes?: number
        }
        Returns: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          offer_expires_at: string | null
          offer_reservation_id: string | null
          party_size: number
          requested_date: string
          requested_time: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "waitlist_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      loyalty_balance: {
        Args: { p_customer: string; p_tenant: string }
        Returns: number
      }
      record_visit: {
        Args: {
          p_bill_ref: string
          p_customer: string
          p_spend_cents: number
          p_tenant: string
        }
        Returns: {
          already_recorded: boolean
          is_vip: boolean
          points_earned: number
          visit_count: number
        }[]
      }
      redeem_claim: {
        Args: {
          p_distance: number
          p_lat: number
          p_lon: number
          p_token: string
          p_voucher: string
        }
        Returns: {
          discount_cents: number
          voucher_code: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
