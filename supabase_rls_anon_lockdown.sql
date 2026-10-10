-- ============================================================
-- ANON LOCKDOWN — restrict all anonymous (parent portal) access
-- to only data belonging to the event they have the access code for.
--
-- Problem: previous policies used USING (is_active = true) or
-- USING (true), meaning ANY anonymous user could enumerate events,
-- results, and records from ALL schools by querying Supabase directly.
--
-- Fix: anon can only read data for an event whose parent_access_code
-- they supply via a session variable, OR via SECURITY DEFINER RPCs
-- (get_parent_portal_event, search_students_for_parent).
--
-- How the access code is passed:
--   The app calls set_config('app.parent_access_code', code, true)
--   before any anon query. Policies read it with
--   current_setting('app.parent_access_code', true).
--   If not set, current_setting returns NULL and the policy blocks.
-- ============================================================

-- ── Helper: get the event_id the anon user is allowed to see ──
CREATE OR REPLACE FUNCTION get_parent_event_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM events
  WHERE parent_access_code = current_setting('app.parent_access_code', true)
    AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_parent_event_id() TO anon;

-- ── EVENTS: anon can only read the one event they have the code for ──
DROP POLICY IF EXISTS "events_parent_portal_select" ON events;
CREATE POLICY "events_parent_portal_select" ON events
  FOR SELECT TO anon
  USING (id = get_parent_event_id());

-- ── EVENT_ACTIVITIES: anon can only read activities for their event ──
DROP POLICY IF EXISTS "event_activities_anon_select" ON event_activities;
CREATE POLICY "event_activities_anon_select" ON event_activities
  FOR SELECT TO anon
  USING (event_id = get_parent_event_id());

-- ── EVENT_RESULTS: anon can only read results for their event ──
DROP POLICY IF EXISTS "event_results_anon_select" ON event_results;
CREATE POLICY "event_results_anon_select" ON event_results
  FOR SELECT TO anon
  USING (
    event_activity_id IN (
      SELECT id FROM event_activities WHERE event_id = get_parent_event_id()
    )
  );

-- ── SCHOOL_HOUSES: anon can only read houses for their event's school ──
DROP POLICY IF EXISTS "school_houses_anon_select" ON school_houses;
CREATE POLICY "school_houses_anon_select" ON school_houses
  FOR SELECT TO anon
  USING (
    school_id = (SELECT school_id FROM events WHERE id = get_parent_event_id())
  );

-- ── EVENT_RECORDS: anon can only read records for their event's school ──
DROP POLICY IF EXISTS "event_records_anon_select" ON event_records;
CREATE POLICY "event_records_anon_select" ON event_records
  FOR SELECT TO anon
  USING (
    school_id = (SELECT school_id FROM events WHERE id = get_parent_event_id())
  );

-- ── HISTORICAL_RECORDS: same — scoped to the school of the accessed event ──
DROP POLICY IF EXISTS "historical_records_public_read" ON historical_records;
CREATE POLICY "historical_records_public_read" ON historical_records
  FOR SELECT TO anon
  USING (
    school_id = (SELECT school_id FROM events WHERE id = get_parent_event_id())
  );
