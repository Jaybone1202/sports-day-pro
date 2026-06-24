-- ============================================================
-- RLS PATCH — fixes the event_participants policy error
-- Run this in Supabase SQL Editor after the main script
-- ============================================================

-- First let's see what columns event_participants actually has,
-- then apply the correct policy based on school_id directly.

DROP POLICY IF EXISTS "event_participants_own_school" ON event_participants;

-- This version uses school_id directly on the table (most likely structure).
-- If this also errors, please check the table Definition tab and let me know the columns.
CREATE POLICY "event_participants_own_school" ON event_participants
  FOR ALL
  USING (school_id = get_my_school_id());
