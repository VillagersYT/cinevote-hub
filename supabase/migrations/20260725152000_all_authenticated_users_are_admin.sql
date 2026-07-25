-- Public sign-ups must stay disabled in Supabase Auth.
-- Every account that can open a valid Supabase session is an administrator.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Public movie proposals and votes now go through verified server functions.
-- This prevents direct REST requests from bypassing the TMDB filters, proposal
-- limits, voting windows, and ownership checks.
DROP POLICY IF EXISTS "options public insert" ON public.poll_options;
REVOKE INSERT ON public.poll_options FROM anon;

DROP POLICY IF EXISTS "votes public read" ON public.votes;
DROP POLICY IF EXISTS "votes public insert" ON public.votes;
DROP POLICY IF EXISTS "votes public delete" ON public.votes;
REVOKE SELECT, INSERT, DELETE ON public.votes FROM anon;

-- Existing authenticated accounts remain able to manage everything through
-- the admin policies. The service role is used only inside server functions.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO authenticated;

CREATE INDEX IF NOT EXISTS poll_options_screening_proposer_idx
  ON public.poll_options (screening_id, proposer_voter_id);

CREATE INDEX IF NOT EXISTS votes_screening_voter_idx
  ON public.votes (screening_id, voter_id);
