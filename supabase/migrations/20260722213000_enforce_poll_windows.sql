DROP POLICY IF EXISTS "options public insert" ON public.poll_options;
CREATE POLICY "options public insert" ON public.poll_options FOR INSERT WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM public.screenings s
    WHERE s.id = screening_id
      AND s.allow_public_proposals = true
      AND s.status = 'open'
      AND (s.poll_opens_at IS NULL OR s.poll_opens_at <= now())
      AND (s.poll_closes_at IS NULL OR s.poll_closes_at > now())
  )
);

DROP POLICY IF EXISTS "votes public insert" ON public.votes;
CREATE POLICY "votes public insert" ON public.votes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM public.screenings s
    WHERE s.id = screening_id
      AND s.status = 'open'
      AND (s.poll_opens_at IS NULL OR s.poll_opens_at <= now())
      AND (s.poll_closes_at IS NULL OR s.poll_closes_at > now())
      AND (
        SELECT COUNT(*)
        FROM public.votes v
        WHERE v.voter_id = votes.voter_id
          AND v.screening_id = votes.screening_id
      ) < s.votes_per_voter
  )
);

DROP POLICY IF EXISTS "votes public delete" ON public.votes;
CREATE POLICY "votes public delete" ON public.votes FOR DELETE USING (
  EXISTS (
    SELECT
      1
    FROM public.screenings s
    WHERE s.id = votes.screening_id
      AND s.status = 'open'
      AND (s.poll_opens_at IS NULL OR s.poll_opens_at <= now())
      AND (s.poll_closes_at IS NULL OR s.poll_closes_at > now())
  )
);

CREATE INDEX IF NOT EXISTS votes_screening_id_voter_id_idx
  ON public.votes (screening_id, voter_id);
