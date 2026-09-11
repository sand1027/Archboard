// Auto-generated Supabase types — keep in sync with your schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          thumbnail_url?: string | null
          data: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          thumbnail_url?: string | null
          data?: Json
          created_at?: string
          updated_at?: string
        }
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
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type DiagramRow = Database['public']['Tables']['diagrams']['Row']
export type DiagramVersionRow = Database['public']['Tables']['diagram_versions']['Row']
