-- Idempotent RLS + storage hardening.
-- 1. Tighten public INSERT on analytics_events (no arbitrary user_id spoofing).
-- 2. Stop authenticated users from reading other sessions' recommendations.
-- 3. Fix mistyped MIME 'imagepng' → 'image/png' on AI storage buckets.

-- ------------------------------------------------------------
-- analytics_events: INSERT must belong to the caller (or be anonymous).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS events_insert_own ON public.analytics_events;
CREATE POLICY events_insert_own ON public.analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- ------------------------------------------------------------
-- recommendations: read only the caller's own rows.
-- (Previous policy allowed any authenticated user to read every
--  anonymous session_id row.)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS recommendations_read_own ON public.recommendations;
CREATE POLICY recommendations_read_own ON public.recommendations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- storage buckets MIME typo (imagepng → image/png)
-- ------------------------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'ai-generations';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/json']
WHERE id = 'ai-assets';
