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
      app_errors: {
        Row: {
          admin_notes: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          page_url: string | null
          source: string
          stack: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          source: string
          stack?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          source?: string
          stack?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_members: {
        Row: {
          campaign_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_pages: {
        Row: {
          campaign_id: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          parent_id: string | null
          revision: number
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          campaign_id: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          parent_id?: string | null
          revision?: number
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          campaign_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          parent_id?: string | null
          revision?: number
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_pages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "campaign_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string
          hp_rule: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
          system_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          hp_rule?: string | null
          id?: string
          invite_code?: string
          name: string
          owner_id: string
          system_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          hp_rule?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "game_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      character_content_refs: {
        Row: {
          character_id: string
          choice_source: string | null
          content_id: string
          content_version: number
          context: Json
          created_at: string
          feature_grant_id: string | null
          id: string
        }
        Insert: {
          character_id: string
          choice_source?: string | null
          content_id: string
          content_version: number
          context?: Json
          created_at?: string
          feature_grant_id?: string | null
          id?: string
        }
        Update: {
          character_id?: string
          choice_source?: string | null
          content_id?: string
          content_version?: number
          context?: Json
          created_at?: string
          feature_grant_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_content_refs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_content_refs_content_version_fkey"
            columns: ["content_id", "content_version"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["content_id", "version"]
          },
          {
            foreignKeyName: "character_content_refs_feature_grant_id_fkey"
            columns: [
              "feature_grant_id",
              "character_id",
              "content_id",
              "content_version",
            ]
            isOneToOne: false
            referencedRelation: "character_feature_grants"
            referencedColumns: [
              "id",
              "character_id",
              "feature_content_id",
              "feature_version",
            ]
          },
        ]
      }
      character_dm_notes: {
        Row: {
          character_id: string
          content: Json
          updated_at: string
        }
        Insert: {
          character_id: string
          content?: Json
          updated_at?: string
        }
        Update: {
          character_id?: string
          content?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_dm_notes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_feature_grants: {
        Row: {
          character_id: string
          controller_ref_id: string
          controller_slug: string
          controller_type: string
          created_at: string
          feature_content_id: string
          feature_slug: string
          feature_version: number
          id: string
          unlock_level: number
        }
        Insert: {
          character_id: string
          controller_ref_id: string
          controller_slug: string
          controller_type: string
          created_at?: string
          feature_content_id: string
          feature_slug: string
          feature_version: number
          id?: string
          unlock_level: number
        }
        Update: {
          character_id?: string
          controller_ref_id?: string
          controller_slug?: string
          controller_type?: string
          created_at?: string
          feature_content_id?: string
          feature_slug?: string
          feature_version?: number
          id?: string
          unlock_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_feature_grants_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_feature_grants_controller_ref_id_fkey"
            columns: ["controller_ref_id", "character_id"]
            isOneToOne: false
            referencedRelation: "character_content_refs"
            referencedColumns: ["id", "character_id"]
          },
          {
            foreignKeyName: "character_feature_grants_feature_version_fkey"
            columns: ["feature_content_id", "feature_version"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["content_id", "version"]
          },
        ]
      }
      character_inventory: {
        Row: {
          attuned: boolean
          character_id: string
          content_id: string | null
          content_type: string
          content_version: number | null
          created_at: string
          custom_data: Json | null
          equipped: boolean
          id: string
          name: string
          notes: string | null
          quantity: number
          sort_order: number
        }
        Insert: {
          attuned?: boolean
          character_id: string
          content_id?: string | null
          content_type?: string
          content_version?: number | null
          created_at?: string
          custom_data?: Json | null
          equipped?: boolean
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          sort_order?: number
        }
        Update: {
          attuned?: boolean
          character_id?: string
          content_id?: string | null
          content_type?: string
          content_version?: number | null
          created_at?: string
          custom_data?: Json | null
          equipped?: boolean
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_inventory_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_inventory_content_version_fkey"
            columns: ["content_id", "content_version"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["content_id", "version"]
          },
        ]
      }
      character_rolls: {
        Row: {
          character_id: string
          expression: string
          id: string
          kind: string
          label: string
          result: Json
          rolled_at: string
          total: number
          user_id: string
        }
        Insert: {
          character_id: string
          expression: string
          id?: string
          kind: string
          label: string
          result: Json
          rolled_at?: string
          total: number
          user_id?: string
        }
        Update: {
          character_id?: string
          expression?: string
          id?: string
          kind?: string
          label?: string
          result?: Json
          rolled_at?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_rolls_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_rolls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      character_spell_grants: {
        Row: {
          character_id: string
          class_slug: string
          controller_ref_id: string
          controller_slug: string
          controller_type: string
          created_at: string
          id: string
          spell_content_id: string
          spell_name: string
          spell_slug: string
          spell_version: number
          unlock_level: number
        }
        Insert: {
          character_id: string
          class_slug: string
          controller_ref_id: string
          controller_slug: string
          controller_type: string
          created_at?: string
          id?: string
          spell_content_id: string
          spell_name: string
          spell_slug: string
          spell_version: number
          unlock_level: number
        }
        Update: {
          character_id?: string
          class_slug?: string
          controller_ref_id?: string
          controller_slug?: string
          controller_type?: string
          created_at?: string
          id?: string
          spell_content_id?: string
          spell_name?: string
          spell_slug?: string
          spell_version?: number
          unlock_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_spell_grants_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spell_grants_controller_ref_fkey"
            columns: ["controller_ref_id", "character_id"]
            isOneToOne: false
            referencedRelation: "character_content_refs"
            referencedColumns: ["id", "character_id"]
          },
          {
            foreignKeyName: "character_spell_grants_spell_version_fkey"
            columns: ["spell_content_id", "spell_version"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["content_id", "version"]
          },
        ]
      }
      character_spells: {
        Row: {
          always_prepared: boolean
          character_id: string
          class_slug: string
          content_id: string | null
          content_version: number | null
          created_at: string
          custom_data: Json | null
          id: string
          in_spellbook: boolean
          is_known: boolean
          is_prepared: boolean
          name: string
          source: string
          spell_grant_id: string | null
        }
        Insert: {
          always_prepared?: boolean
          character_id: string
          class_slug: string
          content_id?: string | null
          content_version?: number | null
          created_at?: string
          custom_data?: Json | null
          id?: string
          in_spellbook?: boolean
          is_known?: boolean
          is_prepared?: boolean
          name: string
          source?: string
          spell_grant_id?: string | null
        }
        Update: {
          always_prepared?: boolean
          character_id?: string
          class_slug?: string
          content_id?: string | null
          content_version?: number | null
          created_at?: string
          custom_data?: Json | null
          id?: string
          in_spellbook?: boolean
          is_known?: boolean
          is_prepared?: boolean
          name?: string
          source?: string
          spell_grant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_spells_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spells_content_version_fkey"
            columns: ["content_id", "content_version"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["content_id", "version"]
          },
          {
            foreignKeyName: "character_spells_spell_grant_character_fkey"
            columns: [
              "spell_grant_id",
              "character_id",
              "content_id",
              "content_version",
              "class_slug",
            ]
            isOneToOne: false
            referencedRelation: "character_spell_grants"
            referencedColumns: [
              "id",
              "character_id",
              "spell_content_id",
              "spell_version",
              "class_slug",
            ]
          },
        ]
      }
      character_timeline_events: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          date_label: string | null
          description: Json
          id: string
          sort_order: number
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          date_label?: string | null
          description?: Json
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          date_label?: string | null
          description?: Json
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_timeline_events_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_timeline_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          archived: boolean
          base_stats: Json
          campaign_id: string | null
          choices: Json
          created_at: string
          id: string
          level: number
          name: string
          narrative: Json
          narrative_rich: Json
          primary_color: string | null
          state: Json
          system_id: string
          user_id: string
          visibility: string
        }
        Insert: {
          archived?: boolean
          base_stats?: Json
          campaign_id?: string | null
          choices?: Json
          created_at?: string
          id?: string
          level?: number
          name: string
          narrative?: Json
          narrative_rich?: Json
          primary_color?: string | null
          state?: Json
          system_id: string
          user_id: string
          visibility?: string
        }
        Update: {
          archived?: boolean
          base_stats?: Json
          campaign_id?: string | null
          choices?: Json
          created_at?: string
          id?: string
          level?: number
          name?: string
          narrative?: Json
          narrative_rich?: Json
          primary_color?: string | null
          state?: Json
          system_id?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "game_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_definitions: {
        Row: {
          content_type: string
          created_at: string
          data: Json
          effects: Json
          id: string
          is_retired: boolean
          name: string
          owner_id: string | null
          scope: string
          slug: string
          source: string
          system_id: string
          version: number
        }
        Insert: {
          content_type: string
          created_at?: string
          data?: Json
          effects?: Json
          id?: string
          is_retired?: boolean
          name: string
          owner_id?: string | null
          scope?: string
          slug: string
          source?: string
          system_id: string
          version?: number
        }
        Update: {
          content_type?: string
          created_at?: string
          data?: Json
          effects?: Json
          id?: string
          is_retired?: boolean
          name?: string
          owner_id?: string | null
          scope?: string
          slug?: string
          source?: string
          system_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_definitions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_definitions_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "game_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      content_shares: {
        Row: {
          campaign_id: string
          content_id: string
          id: string
          shared_at: string
          shared_by: string
        }
        Insert: {
          campaign_id: string
          content_id: string
          id?: string
          shared_at?: string
          shared_by: string
        }
        Update: {
          campaign_id?: string
          content_id?: string
          id?: string
          shared_at?: string
          shared_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_shares_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_shares_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_type_shares: {
        Row: {
          campaign_id: string
          content_type_id: string
          id: string
          shared_at: string
          shared_by: string
        }
        Insert: {
          campaign_id: string
          content_type_id: string
          id?: string
          shared_at?: string
          shared_by: string
        }
        Update: {
          campaign_id?: string
          content_type_id?: string
          id?: string
          shared_at?: string
          shared_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_type_shares_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_type_shares_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "custom_content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_type_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          changelog: string
          content_id: string
          content_type_snapshot: string
          created_at: string
          data_snapshot: Json
          effects_snapshot: Json
          id: string
          name_snapshot: string
          owner_id_snapshot: string | null
          scope_snapshot: string
          slug_snapshot: string
          source_snapshot: string
          system_id_snapshot: string
          version: number
        }
        Insert: {
          changelog?: string
          content_id: string
          content_type_snapshot: string
          created_at?: string
          data_snapshot: Json
          effects_snapshot?: Json
          id?: string
          name_snapshot: string
          owner_id_snapshot?: string | null
          scope_snapshot: string
          slug_snapshot: string
          source_snapshot: string
          system_id_snapshot: string
          version: number
        }
        Update: {
          changelog?: string
          content_id?: string
          content_type_snapshot?: string
          created_at?: string
          data_snapshot?: Json
          effects_snapshot?: Json
          id?: string
          name_snapshot?: string
          owner_id_snapshot?: string | null
          scope_snapshot?: string
          slug_snapshot?: string
          source_snapshot?: string
          system_id_snapshot?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_content_types: {
        Row: {
          allow_multiple: boolean
          description: string
          entry_conditions: Json
          has_progression: boolean
          id: string
          name: string
          owner_id: string
          scope: string
          slug: string
          system_id: string
          version: number
        }
        Insert: {
          allow_multiple?: boolean
          description?: string
          entry_conditions?: Json
          has_progression?: boolean
          id?: string
          name: string
          owner_id: string
          scope?: string
          slug: string
          system_id: string
          version?: number
        }
        Update: {
          allow_multiple?: boolean
          description?: string
          entry_conditions?: Json
          has_progression?: boolean
          id?: string
          name?: string
          owner_id?: string
          scope?: string
          slug?: string
          system_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_content_types_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_content_types_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "game_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          page_url: string | null
          status: string
          tag: string | null
          text: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          status?: string
          tag?: string | null
          text: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          status?: string
          tag?: string | null
          text?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      game_systems: {
        Row: {
          created_at: string
          expression_context: Json
          id: string
          name: string
          schema_definition: Json
          slug: string
          status: string
          version_label: string
        }
        Insert: {
          created_at?: string
          expression_context?: Json
          id?: string
          name: string
          schema_definition?: Json
          slug: string
          status?: string
          version_label?: string
        }
        Update: {
          created_at?: string
          expression_context?: Json
          id?: string
          name?: string
          schema_definition?: Json
          slug?: string
          status?: string
          version_label?: string
        }
        Relationships: []
      }
      npcs: {
        Row: {
          character_id: string
          created_at: string
          created_by: string
          description: Json
          id: string
          metadata: Json
          name: string
          portrait_url: string | null
          relationship: string | null
          visibility: string
        }
        Insert: {
          character_id: string
          created_at?: string
          created_by: string
          description?: Json
          id?: string
          metadata?: Json
          name: string
          portrait_url?: string | null
          relationship?: string | null
          visibility?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          created_by?: string
          description?: Json
          id?: string
          metadata?: Json
          name?: string
          portrait_url?: string | null
          relationship?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "npcs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npcs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          preferences: Json
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id: string
          preferences?: Json
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          preferences?: Json
        }
        Relationships: []
      }
      srd_import_batches: {
        Row: {
          allow_destructive_retirement: boolean
          created_at: string
          expected_count: number
          id: string
          system_id: string
        }
        Insert: {
          allow_destructive_retirement?: boolean
          created_at?: string
          expected_count: number
          id: string
          system_id: string
        }
        Update: {
          allow_destructive_retirement?: boolean
          created_at?: string
          expected_count?: number
          id?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "srd_import_batches_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "game_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      srd_import_staging: {
        Row: {
          batch_id: string
          content_type: string
          data: Json
          effects: Json
          name: string
          owner_id: string | null
          scope: string
          slug: string
          source: string
          system_id: string
        }
        Insert: {
          batch_id: string
          content_type: string
          data: Json
          effects: Json
          name: string
          owner_id?: string | null
          scope: string
          slug: string
          source: string
          system_id: string
        }
        Update: {
          batch_id?: string
          content_type?: string
          data?: Json
          effects?: Json
          name?: string
          owner_id?: string | null
          scope?: string
          slug?: string
          source?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "srd_import_staging_batch_system_fkey"
            columns: ["batch_id", "system_id"]
            isOneToOne: false
            referencedRelation: "srd_import_batches"
            referencedColumns: ["id", "system_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      copy_character: {
        Args: {
          copied_name?: string
          source_character_id: string
          target_campaign_id?: string
        }
        Returns: string
      }
      create_campaign_page: {
        Args: {
          page_title: string
          page_visibility?: string
          parent_page_id?: string
          target_campaign_id: string
        }
        Returns: string
      }
      get_active_character_spell_grants: {
        Args: { target_character_id: string }
        Returns: Json
      }
      join_campaign_by_invite_code: {
        Args: { provided_invite_code: string }
        Returns: string
      }
      leave_campaign: {
        Args: { target_campaign_id: string }
        Returns: undefined
      }
      patch_character_state: {
        Args: { character_id: string; state_patch: Json }
        Returns: undefined
      }
      promote_srd_import: {
        Args: { p_batch_id: string }
        Returns: {
          retired_count: number
          upserted_count: number
        }[]
      }
      remove_campaign_member: {
        Args: { target_campaign_id: string; target_user_id: string }
        Returns: undefined
      }
      rotate_campaign_invite_code: {
        Args: { target_campaign_id: string }
        Returns: string
      }
      save_character_narrative_rich: {
        Args: {
          dm_notes: Json
          shared_narrative: Json
          target_character_id: string
          write_dm_notes: boolean
        }
        Returns: undefined
      }
      sync_character_feature_refs: {
        Args: { target_character_id: string }
        Returns: {
          deleted: number
          inserted: number
        }[]
      }
      sync_character_spell_grants: {
        Args: { target_character_id: string }
        Returns: {
          active_grants: Json
          deleted: number
          inserted: number
        }[]
      }
      update_campaign_page: {
        Args: {
          expected_revision: number
          page_content: Json
          page_title: string
          page_visibility: string
          target_page_id: string
        }
        Returns: number
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
    Enums: {},
  },
} as const
