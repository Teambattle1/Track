import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yktaxljydisfjyqhbnja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdGF4bGp5ZGlzZmp5cWhibmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzQ2ODYsImV4cCI6MjA4MTcxMDY4Nn0.XeTW4vHGbEm6C7U94zMLsZiDB80cyvuqYbSRNX8oyQI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false // Disable local storage session persistence for anon usage
  }
});