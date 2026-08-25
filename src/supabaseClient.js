import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wolwwrxhpbvhbtciuizw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvbHd3cnhocGJ2aGJ0Y2l1aXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNDEyODAsImV4cCI6MjEwMjgxNzI4MH0.QsMOmhAX1cmPsqFTTtzaAvPECy7cYspNyg5NQ6YGYbg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Ensures the guard terminal has a real Supabase Auth session.
 *
 * The terminal signs in ANONYMOUSLY so every device gets its own
 * authenticated JWT (role `authenticated`) instead of sharing the public
 * anon key. PIN verification then binds that session to a guard via the
 * `bind_guard_session` RPC, and RLS only lets verified sessions touch the
 * PII tables. This is what allows us to remove anonymous access to
 * `hotel_security_logs` / `passes` / `guard_shifts` (see the C2 migration).
 *
 * Requires "Anonymous sign-ins" to be enabled in
 * Supabase -> Authentication -> Providers.
 *
 * @returns the active session, or null if anonymous sign-in is disabled.
 */
export async function ensureAnonSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('Anonymous sign-in failed:', error.message);
    return null;
  }
  return data.session;
}
