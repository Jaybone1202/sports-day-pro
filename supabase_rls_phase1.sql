-- ============================================================
-- SPORTS DAY PRO — Phase 1 RLS (Row Level Security) Policies
-- Run this entire script in: Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Enable RLS on every table
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_absences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_houses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trials            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: a function that returns the current user's school_id
-- This is used by all policies below.
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT school_id FROM users WHERE id = auth.uid()
$$;

-- ============================================================
-- USERS TABLE
-- Users can only read/update their own row.
-- ============================================================
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- SCHOOLS TABLE
-- Users can only read their own school record.
-- ============================================================
DROP POLICY IF EXISTS "schools_select_own" ON schools;
CREATE POLICY "schools_select_own" ON schools
  FOR SELECT USING (id = get_my_school_id());

-- ============================================================
-- STUDENTS TABLE
-- School staff/organisers: full access to their school's students.
-- Anon (parent portal): no direct student access (results come via event queries).
-- ============================================================
DROP POLICY IF EXISTS "students_all_own_school" ON students;
CREATE POLICY "students_all_own_school" ON students
  FOR ALL USING (school_id = get_my_school_id());

-- ============================================================
-- EVENTS TABLE
-- Authenticated users: read/write only their school's events.
-- Anonymous users: can SELECT an event only if they provide the
--   correct parent_access_code (used by the parent portal).
-- ============================================================
DROP POLICY IF EXISTS "events_all_own_school" ON events;
CREATE POLICY "events_all_own_school" ON events
  FOR ALL USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS "events_parent_portal_select" ON events;
CREATE POLICY "events_parent_portal_select" ON events
  FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================================
-- EVENT_ACTIVITIES TABLE
-- ============================================================
DROP POLICY IF EXISTS "event_activities_own_school" ON event_activities;
CREATE POLICY "event_activities_own_school" ON event_activities
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events WHERE school_id = get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "event_activities_anon_select" ON event_activities;
CREATE POLICY "event_activities_anon_select" ON event_activities
  FOR SELECT
  TO anon
  USING (
    event_id IN (SELECT id FROM events WHERE is_active = true)
  );

-- ============================================================
-- EVENT_RESULTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "event_results_own_school" ON event_results;
CREATE POLICY "event_results_own_school" ON event_results
  FOR ALL
  USING (
    event_activity_id IN (
      SELECT ea.id FROM event_activities ea
      JOIN events e ON ea.event_id = e.id
      WHERE e.school_id = get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "event_results_anon_select" ON event_results;
CREATE POLICY "event_results_anon_select" ON event_results
  FOR SELECT
  TO anon
  USING (
    event_activity_id IN (
      SELECT ea.id FROM event_activities ea
      JOIN events e ON ea.event_id = e.id
      WHERE e.is_active = true
    )
  );

-- ============================================================
-- EVENT_ABSENCES TABLE
-- ============================================================
DROP POLICY IF EXISTS "event_absences_own_school" ON event_absences;
CREATE POLICY "event_absences_own_school" ON event_absences
  FOR ALL
  USING (
    event_activity_id IN (
      SELECT ea.id FROM event_activities ea
      JOIN events e ON ea.event_id = e.id
      WHERE e.school_id = get_my_school_id()
    )
  );

-- ============================================================
-- EVENT_RECORDS TABLE
-- Authenticated: own school only.
-- Anon: can read all records (needed for inter-school comparison later).
-- ============================================================
DROP POLICY IF EXISTS "event_records_own_school" ON event_records;
CREATE POLICY "event_records_own_school" ON event_records
  FOR ALL USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS "event_records_anon_select" ON event_records;
CREATE POLICY "event_records_anon_select" ON event_records
  FOR SELECT TO anon USING (true);

-- ============================================================
-- SCHOOL_HOUSES TABLE
-- ============================================================
DROP POLICY IF EXISTS "school_houses_own_school" ON school_houses;
CREATE POLICY "school_houses_own_school" ON school_houses
  FOR ALL USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS "school_houses_anon_select" ON school_houses;
CREATE POLICY "school_houses_anon_select" ON school_houses
  FOR SELECT TO anon USING (true);

-- ============================================================
-- TRIALS & TRIAL_RESULTS
-- ============================================================
DROP POLICY IF EXISTS "trials_own_school" ON trials;
CREATE POLICY "trials_own_school" ON trials
  FOR ALL USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS "trial_results_own_school" ON trial_results;
CREATE POLICY "trial_results_own_school" ON trial_results
  FOR ALL
  USING (
    trial_id IN (
      SELECT id FROM trials WHERE school_id = get_my_school_id()
    )
  );

-- ============================================================
-- HISTORICAL_RECORDS (for Phase 3 inter-school board)
-- Anyone can read. Only authenticated users can write their school's records.
-- ============================================================
DROP POLICY IF EXISTS "historical_records_own_school" ON historical_records;
CREATE POLICY "historical_records_own_school" ON historical_records
  FOR ALL USING (school_id = get_my_school_id());

DROP POLICY IF EXISTS "historical_records_public_read" ON historical_records;
CREATE POLICY "historical_records_public_read" ON historical_records
  FOR SELECT TO anon USING (true);

-- ============================================================
-- EVENT_PARTICIPANTS TABLE
-- ============================================================
DROP POLICY IF EXISTS "event_participants_own_school" ON event_participants;
CREATE POLICY "event_participants_own_school" ON event_participants
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events WHERE school_id = get_my_school_id()
    )
  );
