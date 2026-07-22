
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role);
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Screenings (séances)
CREATE TABLE public.screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  scheduled_at TIMESTAMPTZ,
  poll_opens_at TIMESTAMPTZ,
  poll_closes_at TIMESTAMPTZ,
  allow_public_proposals BOOLEAN NOT NULL DEFAULT true,
  max_proposals_per_voter INT NOT NULL DEFAULT 3,
  votes_per_voter INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',
  winner_movie_id INT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.screenings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screenings TO authenticated;
GRANT ALL ON public.screenings TO service_role;
ALTER TABLE public.screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenings public read" ON public.screenings FOR SELECT USING (true);
CREATE POLICY "screenings admin write" ON public.screenings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Proposed movies for a screening
CREATE TABLE public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id UUID NOT NULL REFERENCES public.screenings(id) ON DELETE CASCADE,
  tmdb_id INT NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  release_year INT,
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  runtime INT,
  proposer_name TEXT,
  proposer_voter_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(screening_id, tmdb_id)
);
GRANT SELECT, INSERT ON public.poll_options TO anon, authenticated;
GRANT UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT ALL ON public.poll_options TO service_role;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "options public read" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "options public insert" ON public.poll_options FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.screenings s WHERE s.id = screening_id
    AND s.allow_public_proposals = true
    AND s.status = 'open'
    AND (s.poll_closes_at IS NULL OR s.poll_closes_at > now()))
);
CREATE POLICY "options admin manage" ON public.poll_options FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Votes
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  screening_id UUID NOT NULL REFERENCES public.screenings(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(option_id, voter_id)
);
GRANT SELECT, INSERT, DELETE ON public.votes TO anon, authenticated;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes public read" ON public.votes FOR SELECT USING (true);
CREATE POLICY "votes public insert" ON public.votes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.screenings s WHERE s.id = screening_id
    AND s.status = 'open'
    AND (s.poll_closes_at IS NULL OR s.poll_closes_at > now())
    AND (s.poll_opens_at IS NULL OR s.poll_opens_at <= now())
    AND (SELECT COUNT(*) FROM public.votes v WHERE v.voter_id = votes.voter_id AND v.screening_id = votes.screening_id) < s.votes_per_voter
  )
);
CREATE POLICY "votes public delete" ON public.votes FOR DELETE USING (true);
CREATE POLICY "votes admin manage" ON public.votes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Site settings (personnalisation)
CREATE TABLE public.site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  site_name TEXT NOT NULL DEFAULT 'Ciné-Club',
  tagline TEXT DEFAULT 'Votez pour le prochain film de la séance',
  primary_color TEXT DEFAULT '#f97316',
  accent_color TEXT DEFAULT '#fbbf24',
  hero_image_url TEXT,
  about_text TEXT,
  footer_text TEXT,
  default_votes_per_voter INT NOT NULL DEFAULT 1,
  default_max_proposals INT NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER screenings_updated BEFORE UPDATE ON public.screenings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
