import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wolwwrxhpbvhbtciuizw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvbHd3cnhocGJ2aGJ0Y2l1aXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNDEyODAsImV4cCI6MjEwMjgxNzI4MH0.QsMOmhAX1cmPsqFTTtzaAvPECy7cYspNyg5NQ6YGYbg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
