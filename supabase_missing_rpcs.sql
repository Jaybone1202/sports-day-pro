-- ============================================================
-- Missing RPCs for Sports Day Pro
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── search_students_for_parent ────────────────────────────────
-- Called by the parent portal child-search feature.
-- Anon cannot query the students table directly (RLS blocks it),
-- so this SECURITY DEFINER RPC validates the access code then
-- returns matching students from that school only.
-- Returns id, first_name, last_name, class, age_group, gender, house.

DROP FUNCTION IF EXISTS search_students_for_parent(text, text);

CREATE OR REPLACE FUNCTION search_students_for_parent(
  p_access_code text,
  p_search      text
)
RETURNS TABLE (
  id         uuid,
  first_name text,
  last_name  text,
  class      text,
  age_group  text,
  gender     text,
  house      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  -- Validate access code and get school_id from the active event
  SELECT e.school_id INTO v_school_id
  FROM events e
  WHERE e.parent_access_code = p_access_code
    AND e.status IN ('active', 'locked')
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RETURN; -- Invalid code — return empty result set
  END IF;

  -- Return students matching the search term within that school
  RETURN QUERY
  SELECT
    s.id,
    s.first_name,
    s.last_name,
    s.class,
    s.age_group,
    s.gender,
    s.house
  FROM students s
  WHERE s.school_id = v_school_id
    AND (
      s.first_name ILIKE '%' || p_search || '%'
      OR s.last_name  ILIKE '%' || p_search || '%'
    )
  ORDER BY s.last_name, s.first_name
  LIMIT 50;
END;
$$;

-- Grant execute to anon so the parent portal (unauthenticated) can call it
GRANT EXECUTE ON FUNCTION search_students_for_parent(text, text) TO anon;
