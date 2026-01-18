import { createClient } from '@supabase/supabase-js';

// NOTE: These defaults keep the app working out-of-the-box.
// For production, prefer providing Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// or setting localStorage keys (SUPABASE_URL / SUPABASE_ANON_KEY) so you can rotate without code changes.
const DEFAULT_SUPABASE_URL = 'https://yktaxljydisfjyqhbnja.supabase.co';
// Standard Supabase JWT anon key
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdGF4bGp5ZGlzZmp5cWhibmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzQ2ODYsImV4cCI6MjA4MTcxMDY4Nn0.XeTW4vHGbEm6C7U94zMLsZiDB80cyvuqYbSRNX8oyQI';

const getSupabaseUrl = () => {
  const local = typeof window !== 'undefined' ? localStorage.getItem('SUPABASE_URL') : null;
  const env = (import.meta as any).env?.VITE_SUPABASE_URL;
  return local || env || DEFAULT_SUPABASE_URL;
};

const getSupabaseAnonKey = () => {
  const local = typeof window !== 'undefined' ? localStorage.getItem('SUPABASE_ANON_KEY') : null;
  const env = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  return local || env || DEFAULT_SUPABASE_ANON_KEY;
};

export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: {
    persistSession: false
  }
});
