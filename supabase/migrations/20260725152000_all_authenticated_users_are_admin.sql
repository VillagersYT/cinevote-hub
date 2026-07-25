-- IMPORTANT:
-- Les inscriptions publiques doivent rester désactivées dans Supabase Auth.
-- Tous les comptes capables d'ouvrir une session Supabase sont administrateurs.
--
-- Ce script peut être exécuté plusieurs fois sans erreur.

BEGIN;

-- Conserve la fonction pour les anciennes parties du projet qui l'utilisent
-- encore, mais ne fait plus dépendre l'administration de public.user_roles.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Les visiteurs peuvent lire les séances, les films proposés et les réglages.
GRANT SELECT ON public.screenings TO anon, authenticated;
GRANT SELECT ON public.poll_options TO anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;

-- Toute session authentifiée peut administrer les quatre tables du panel.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screenings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

-- Les écritures publiques passent uniquement par les fonctions serveur.
REVOKE INSERT, UPDATE, DELETE ON public.screenings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.poll_options FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.votes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM anon;

-- Supprime toutes les anciennes politiques qui pouvaient encore appeler
-- public.user_roles ou une ancienne version de public.is_admin().
DROP POLICY IF EXISTS "screenings public read" ON public.screenings;
DROP POLICY IF EXISTS "screenings admin write" ON public.screenings;
DROP POLICY IF EXISTS "screenings authenticated manage" ON public.screenings;

DROP POLICY IF EXISTS "options public read" ON public.poll_options;
DROP POLICY IF EXISTS "options public insert" ON public.poll_options;
DROP POLICY IF EXISTS "options admin manage" ON public.poll_options;
DROP POLICY IF EXISTS "options authenticated manage" ON public.poll_options;

DROP POLICY IF EXISTS "votes public read" ON public.votes;
DROP POLICY IF EXISTS "votes public insert" ON public.votes;
DROP POLICY IF EXISTS "votes public delete" ON public.votes;
DROP POLICY IF EXISTS "votes admin manage" ON public.votes;
DROP POLICY IF EXISTS "votes authenticated manage" ON public.votes;

DROP POLICY IF EXISTS "settings public read" ON public.site_settings;
DROP POLICY IF EXISTS "settings admin write" ON public.site_settings;
DROP POLICY IF EXISTS "settings authenticated manage" ON public.site_settings;

-- Lecture publique.
CREATE POLICY "screenings public read"
ON public.screenings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "options public read"
ON public.poll_options
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "settings public read"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Administration : la condition ne dépend plus d'une ligne dans user_roles.
CREATE POLICY "screenings authenticated manage"
ON public.screenings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "options authenticated manage"
ON public.poll_options
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "votes authenticated manage"
ON public.votes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "settings authenticated manage"
ON public.site_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS poll_options_screening_proposer_idx
  ON public.poll_options (screening_id, proposer_voter_id);

CREATE INDEX IF NOT EXISTS votes_screening_voter_idx
  ON public.votes (screening_id, voter_id);

COMMIT;
