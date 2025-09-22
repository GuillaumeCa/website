import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl = "";
const supabaseAnonKey = "";

console.log('🔧 Configuration Supabase:');
console.log('  URL:', supabaseUrl ? '✅ Définie' : '❌ Manquante');
console.log('  Anon Key:', supabaseAnonKey ? '✅ Définie' : '❌ Manquante');
console.log('  URL complète:', supabaseUrl);
console.log('  Anon Key (premiers chars):', supabaseAnonKey?.substring(0, 20) + '...');

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { db: { schema: 'dyingstar' } })
  : null;

if (supabase) {
  console.log('🚀 Client Supabase créé avec schéma: dyingstar');
} else {
  console.warn('⚠️ Supabase non configuré. Client non initialisé.');
}

export type Database = {
  dyingstar: {
    Tables: {
      roadmap_items: {
        Row: {
          id: string;
          phase: string;
          title: string;
          status: 'completed' | 'in-progress' | 'planned' | 'future';
          progress: number;
          quarter: string;
          items: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phase: string;
          title: string;
          status: 'completed' | 'in-progress' | 'planned' | 'future';
          progress: number;
          quarter: string;
          items: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phase?: string;
          title?: string;
          status?: 'completed' | 'in-progress' | 'planned' | 'future';
          progress?: number;
          quarter?: string;
          items?: string[];
          updated_at?: string;
        };
      };
    };
  };
};