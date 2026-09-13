// Auto-generated Supabase types — keep in sync with your schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/** A collaborator invited to a single diagram. */
export type ShareRole = 'viewer' | 'editor'

/** A member of a team. Admins manage membership; the owner is separate. */
export type TeamRole = 'viewer' | 'editor' | 'admin'

export interface Database {
  public: {
    Tables: {
      diagrams: {
        Row: {
          id: string
          user_id: string
          name: string
          thumbnail_url: string | null
          data: Json
          /** Set to share with a whole team rather than named collaborators. */
          team_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          thumbnail_url?: string | null
          data: Json
          team_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          thumbnail_url?: string | null
          data?: Json
          team_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      diagram_shares: {
        Row: {
          id: string
          diagram_id: string
          /** Null until the invitee has an account; matched by email until then. */
          user_id: string | null
          invited_email: string
          role: ShareRole
          invited_by: string
          created_at: string
        }
        Insert: {
          id?: string
          diagram_id: string
          user_id?: string | null
          invited_email: string
          role?: ShareRole
          invited_by: string
          created_at?: string
        }
        Update: {
          id?: string
          diagram_id?: string
          user_id?: string | null
          invited_email?: string
          role?: ShareRole
          invited_by?: string
          created_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          name: string
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          created_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          team_id: string
          user_id: string
          role: TeamRole
          joined_at: string
        }
        Insert: {
          team_id: string
          user_id: string
          role?: TeamRole
          joined_at?: string
        }
        Update: {
          team_id?: string
          user_id?: string
          role?: TeamRole
          joined_at?: string
        }
        Relationships: []
      }
      diagram_versions: {
        Row: {
          id: string
          diagram_id: string
          user_id: string
          version: number
          name: string
          data: Json
          thumbnail_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          diagram_id: string
          user_id: string
          version?: number
          name: string
          data: Json
          thumbnail_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          diagram_id?: string
          user_id?: string
          version?: number
          name?: string
          data?: Json
          thumbnail_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      /** True when the current user may open this diagram. */
      can_view_diagram: {
        Args: { p_diagram_id: string }
        Returns: boolean
      }
      /** True when the current user may change it. */
      can_edit_diagram: {
        Args: { p_diagram_id: string }
        Returns: boolean
      }
      /** Attaches pending email invites to the signed-in user. Returns the count. */
      claim_pending_shares: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type DiagramRow = Database['public']['Tables']['diagrams']['Row']
export type DiagramVersionRow = Database['public']['Tables']['diagram_versions']['Row']
export type DiagramShareRow = Database['public']['Tables']['diagram_shares']['Row']
export type TeamRow = Database['public']['Tables']['teams']['Row']
export type TeamMemberRow = Database['public']['Tables']['team_members']['Row']

/** How many collaborators a single diagram may have, beside its owner. */
export const MAX_DIAGRAM_COLLABORATORS = 3
