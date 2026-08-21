-- ============================================================
-- Phase 2 Migration: Guards table, Passes table, RLS updates
-- Run this ONCE in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wolwwrxhpbvhbtciuizw/sql
-- ============================================================

-- ── 1. Guards table (PIN-based, no Supabase auth required) ──
CREATE TABLE IF NOT EXISTS guards (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  pin_hash   text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guards ENABLE ROW LEVEL SECURITY;

-- Managers can do everything with guards
DO $$ BEGIN
  DROP POLICY IF EXISTS "managers_full_access_guards" ON guards;
  CREATE POLICY "managers_full_access_guards" ON guards
    FOR ALL USING (
      auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('manager','admin')
      )
    );
END $$;

-- ── 2. verify_guard_pin RPC (accessible by anon — used at login) ──
CREATE OR REPLACE FUNCTION verify_guard_pin(p_name text, p_pin_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g record;
BEGIN
  SELECT id, name, is_active INTO g
  FROM guards
  WHERE name = p_name AND pin_hash = p_pin_hash AND is_active = true;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'guard_id', g.id, 'name', g.name);
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid name or PIN');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_guard_pin(text, text) TO anon;

-- ── 3. Passes table (physical pass pool) ──
CREATE TABLE IF NOT EXISTS passes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_number text        UNIQUE NOT NULL,
  pass_type   text        NOT NULL CHECK (pass_type IN ('visitor','contractor','supplier')),
  status      text        NOT NULL DEFAULT 'available'
                          CHECK (status IN ('available','in_use','inactive')),
  nfc_uid     text,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

-- Managers full access
DO $$ BEGIN
  DROP POLICY IF EXISTS "managers_full_access_passes" ON passes;
  CREATE POLICY "managers_full_access_passes" ON passes
    FOR ALL USING (
      auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('manager','admin')
      )
    );
END $$;

-- Anon (guard terminal) can read passes
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_read_passes" ON passes;
  CREATE POLICY "anon_read_passes" ON passes
    FOR SELECT TO anon USING (true);
END $$;

-- Anon can update pass status (check-in / check-out)
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_update_pass_status" ON passes;
  CREATE POLICY "anon_update_pass_status" ON passes
    FOR UPDATE TO anon USING (true) WITH CHECK (true);
END $$;

-- ── 4. hotel_security_logs — allow anon INSERT/UPDATE/SELECT ──
--    Guards use the terminal without a Supabase auth session.
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_checkin_logs" ON hotel_security_logs;
  CREATE POLICY "anon_checkin_logs" ON hotel_security_logs
    FOR INSERT TO anon WITH CHECK (true);
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_checkout_logs" ON hotel_security_logs;
  CREATE POLICY "anon_checkout_logs" ON hotel_security_logs
    FOR UPDATE TO anon USING (true) WITH CHECK (true);
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select_logs" ON hotel_security_logs;
  CREATE POLICY "anon_select_logs" ON hotel_security_logs
    FOR SELECT TO anon USING (true);
END $$;

-- ── 5. guard_shifts — allow anon (guard terminal starts/ends shifts) ──
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_shifts" ON guard_shifts;
  CREATE POLICY "anon_shifts" ON guard_shifts
    FOR ALL TO anon USING (true) WITH CHECK (true);
END $$;

-- ── Done ──
-- After running this, go to your app and the guard terminal
-- will work with PIN-based login, and the admin portal can
-- manage guards and passes.
