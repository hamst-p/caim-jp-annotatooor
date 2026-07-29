/**
 * Supabase の `public` スキーマに対応する型定義。
 *
 * `supabase gen types typescript` の出力と同じ形をしているため、
 * 将来 CLI で自動生成へ差し替えることもできる。
 */

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
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      translation_rows: {
        Row: {
          id: string;
          project_id: string;
          original: string;
          japanese: string;
          reading: string;
          audio_path: string | null;
          audio_file_name: string | null;
          audio_size: number | null;
          audio_duration: number | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          original?: string;
          japanese?: string;
          reading?: string;
          audio_path?: string | null;
          audio_file_name?: string | null;
          audio_size?: number | null;
          audio_duration?: number | null;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          original?: string;
          japanese?: string;
          reading?: string;
          audio_path?: string | null;
          audio_file_name?: string | null;
          audio_size?: number | null;
          audio_duration?: number | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "translation_rows_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

/** Storage バケット名。 */
export const AUDIO_BUCKET = "translation-audio";
