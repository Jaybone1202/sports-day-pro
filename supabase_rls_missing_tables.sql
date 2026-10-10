-- ============================================================
-- SPORTS DAY PRO — RLS fix: missing tables + role escalation
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. event_flags ───────────────────────────────────────────
-- Flags are scoped by school_id directly on the table.
ALTER TABLE event_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_flags_own_school" ON event_flags;
CREATE POLICY "event_flags_own_school" ON event_flags
  FOR ALL TO authenticated
  USING  (school_id = get_my_school_id())
  WITH CHECK (school_id = get_my_school_id());

-- ── 2. activity_type_defaults ────────────────────────────────
-- Per-school scoring configuration.
ALTER TABLE activity_type_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_type_defaults_own_school" ON activity_type_defaults;
CREATE POLICY "activity_type_defaults_own_school" ON activity_type_defaults
  FOR ALL TO authenticated
  USING  (school_id = get_my_school_id())
  WITH CHECK (school_id = get_my_school_id());

-- ── 3. activity_assignments ──────────────────────────────────
-- Staff ↔ activity assignments, scoped by school_id.
ALTER TABLE activity_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_assignments_own_school" ON activity_assignments;
CREATE POLICY "activity_assignments_own_school" ON activity_assignments
  FOR ALL TO authenticated
  USING  (school_id = get_my_school_id())
  WITH CHECK (school_id = get_my_school_id());

-- ── 4. activity_attempts ─────────────────────────────────────
-- Multi-attempt records scope to the activity's event's school.
ALTER TABLE activity_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_attempts_own_school" ON activity_attempts;
CREATE POLICY "activity_attempts_own_school" ON activity_attempts
  FOR ALL TO authenticated
  USING (
    activity_id IN (
      SELECT ea.id FROM event_activities ea
      JOIN events e ON ea.event_id = e.id
      WHERE e.school_id = get_my_school_id()
    )
  )
  WITH CHECK (
    activity_id IN (
      SELECT ea.id FROM event_activities ea
      JOIN events e ON ea.event_id = e.id
      WHERE e.school_id = get_my_school_id()
    )
  );

-- ── 5. Fix role escalation on users table ────────────────────
-- Old policy had no WITH CHECK — any user could set their own
-- role to organiser/super_admin. New policy locks the role
-- column so it cannot be changed by the user themselves.
-- Organisers managing staff roles goes through explicit
-- organiser policies below.

DROP POLICY IF EXISTS "users_update_own"         ON users;
DROP POLICY IF EXISTS "users_select_own"          ON users;
DROP POLICY IF EXISTS "users_organiser_select"    ON users;
DROP POLICY IF EXISTS "users_organiser_update"    ON users;
DROP POLICY IF EXISTS "users_organiser_delete"    ON users;

-- Staff/organiser can read their own row (needed for get_my_school_id()).
CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Organiser can read all users in their school (for staff listing).
CREATE POLICY "users_organiser_select" ON users
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('organiser', 'super_admin')
  );

-- Any user can update their own personal details — NOT their role, school_id, or id.
-- Column-level: prevent role self-escalation.
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (
    id        = auth.uid()
    AND role      = (SELECT role      FROM users WHERE id = auth.uid())
    AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  );

-- Organiser can update role and details for users in their school
-- (but cannot escalate them to super_admin, and cannot change school_id).
CREATE POLICY "users_organiser_update" ON users
  FOR UPDATE TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('organiser', 'super_admin')
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND role != 'super_admin'
  );

-- Organiser can remove staff from their school.
CREATE POLICY "users_organiser_delete" ON users
  FOR DELETE TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('organiser', 'super_admin')
    AND role != 'super_admin'
  );
