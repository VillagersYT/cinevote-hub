import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { MoviePick } from "@/lib/movie-types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const EXCLUDED_GENRE_IDS = new Set([16, 99]);
const VOTER_COOKIE_NAME = "cinevote_voter";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

type TmdbSearchMovie = {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  genre_ids?: number[];
  adult?: boolean;
};

type TmdbMovieDetails = TmdbSearchMovie & {
  title: string;
  original_title: string;
  genres?: Array<{ id: number }>;
  runtime?: number | null;
};

function getTmdbToken(): string {
  const token = process.env.TMDB_READ_TOKEN;

  if (!token) {
    throw new Error("Le serveur n’a pas de token TMDB. Ajoute TMDB_READ_TOKEN dans Vercel.");
  }

  return token;
}

async function fetchTmdb<T>(path: string, searchParams?: URLSearchParams) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  if (searchParams) {
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getTmdbToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB ne répond pas correctement (${response.status}).`);
  }

  return (await response.json()) as T;
}

function isAllowedMovie(movie: Pick<TmdbSearchMovie, "adult" | "genre_ids">): boolean {
  if (movie.adult === true) {
    return false;
  }

  return !(movie.genre_ids ?? []).some((genreId) => EXCLUDED_GENRE_IDS.has(genreId));
}

function mapMovie(movie: TmdbSearchMovie): MoviePick {
  return {
    id: movie.id,
    title: movie.title ?? "Titre inconnu",
    original_title: movie.original_title ?? movie.title ?? "Titre inconnu",
    overview: movie.overview ?? "",
    poster_path: movie.poster_path ?? null,
    backdrop_path: movie.backdrop_path ?? null,
    release_year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
    runtime: null,
  };
}

async function getValidatedMovie(tmdbId: number): Promise<MoviePick> {
  const params = new URLSearchParams({
    language: "fr-FR",
  });
  const movie = await fetchTmdb<TmdbMovieDetails>(`/movie/${tmdbId}`, params);
  const genreIds = (movie.genres ?? []).map((genre) => genre.id);

  if (movie.adult === true || genreIds.some((genreId) => EXCLUDED_GENRE_IDS.has(genreId))) {
    throw new Error(
      "Ce contenu n’est pas autorisé : seuls les films hors animation et documentaire sont acceptés.",
    );
  }

  return {
    ...mapMovie({
      ...movie,
      genre_ids: genreIds,
    }),
    runtime: movie.runtime ?? null,
  };
}

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  return supabaseAdmin;
}

async function getOrCreateVoterId(): Promise<string> {
  const { getCookie, setCookie } = await import("@tanstack/react-start/server");
  const existing = getCookie(VOTER_COOKIE_NAME);

  if (existing && z.string().uuid().safeParse(existing).success) {
    return existing;
  }

  const voterId = crypto.randomUUID();

  setCookie(VOTER_COOKIE_NAME, voterId, {
    httpOnly: true,
    maxAge: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return voterId;
}

function isPollOpen(screening: {
  status: string;
  poll_opens_at: string | null;
  poll_closes_at: string | null;
}) {
  const now = Date.now();

  return (
    screening.status === "open" &&
    (!screening.poll_opens_at || new Date(screening.poll_opens_at).getTime() <= now) &&
    (!screening.poll_closes_at || new Date(screening.poll_closes_at).getTime() > now)
  );
}

export const searchTmdbMovies = createServerFn({ method: "GET" })
  .validator(
    z.object({
      query: z.string().trim().min(2).max(80),
    }),
  )
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      include_adult: "false",
      language: "fr-FR",
      page: "1",
      query: data.query,
    });
    const payload = await fetchTmdb<{ results?: TmdbSearchMovie[] }>("/search/movie", params);

    return (payload.results ?? []).filter(isAllowedMovie).slice(0, 8).map(mapMovie);
  });

const screeningInput = z.object({
  screeningId: z.string().uuid(),
});

export const getPollState = createServerFn({ method: "GET" })
  .validator(screeningInput)
  .handler(async ({ data }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const voterId = await getOrCreateVoterId();
    const [screeningResult, optionsResult, votesResult] = await Promise.all([
      supabaseAdmin.from("screenings").select("*").eq("id", data.screeningId).maybeSingle(),
      supabaseAdmin
        .from("poll_options")
        .select("*")
        .eq("screening_id", data.screeningId)
        .order("created_at"),
      supabaseAdmin
        .from("votes")
        .select("option_id, voter_id")
        .eq("screening_id", data.screeningId),
    ]);

    if (screeningResult.error) {
      throw screeningResult.error;
    }

    if (!screeningResult.data) {
      throw new Error("Cette séance n’existe pas.");
    }

    if (optionsResult.error) {
      throw optionsResult.error;
    }

    if (votesResult.error) {
      throw votesResult.error;
    }

    const voteCounts: Record<string, number> = {};
    const myVotes: string[] = [];

    for (const vote of votesResult.data ?? []) {
      voteCounts[vote.option_id] = (voteCounts[vote.option_id] ?? 0) + 1;

      if (vote.voter_id === voterId) {
        myVotes.push(vote.option_id);
      }
    }

    const options = optionsResult.data ?? [];
    const publicOptions = options.map(
      ({ proposer_voter_id: _privateVoterId, ...option }) => option,
    );

    return {
      screening: screeningResult.data,
      options: publicOptions,
      voteCounts,
      myVotes,
      myProposalCount: options.filter((option) => option.proposer_voter_id === voterId).length,
      totalVotes: votesResult.data?.length ?? 0,
    };
  });

export const proposeMovie = createServerFn({ method: "POST" })
  .validator(
    z.object({
      proposerName: z.string().trim().max(40).optional(),
      screeningId: z.string().uuid(),
      tmdbId: z.number().int().positive(),
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const voterId = await getOrCreateVoterId();
    const { data: screening, error: screeningError } = await supabaseAdmin
      .from("screenings")
      .select("*")
      .eq("id", data.screeningId)
      .maybeSingle();

    if (screeningError) {
      throw screeningError;
    }

    if (!screening) {
      throw new Error("Cette séance n’existe pas.");
    }

    if (!isPollOpen(screening)) {
      throw new Error("Le sondage n’est pas ouvert.");
    }

    if (!screening.allow_public_proposals) {
      throw new Error("Les propositions publiques sont désactivées.");
    }

    const { count, error: countError } = await supabaseAdmin
      .from("poll_options")
      .select("id", { count: "exact", head: true })
      .eq("screening_id", data.screeningId)
      .eq("proposer_voter_id", voterId);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) >= screening.max_proposals_per_voter) {
      throw new Error(
        `Limite atteinte : ${screening.max_proposals_per_voter} proposition(s) par personne.`,
      );
    }

    const movie = await getValidatedMovie(data.tmdbId);
    const { error: insertError } = await supabaseAdmin.from("poll_options").insert({
      backdrop_path: movie.backdrop_path,
      original_title: movie.original_title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      proposer_name: data.proposerName || null,
      proposer_voter_id: voterId,
      release_year: movie.release_year,
      runtime: movie.runtime,
      screening_id: data.screeningId,
      title: movie.title,
      tmdb_id: movie.id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        throw new Error("Ce film est déjà proposé.");
      }

      throw insertError;
    }

    return { success: true };
  });

export const toggleVote = createServerFn({ method: "POST" })
  .validator(
    z.object({
      optionId: z.string().uuid(),
      screeningId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const voterId = await getOrCreateVoterId();
    const [screeningResult, optionResult, existingVoteResult] = await Promise.all([
      supabaseAdmin.from("screenings").select("*").eq("id", data.screeningId).maybeSingle(),
      supabaseAdmin
        .from("poll_options")
        .select("id, screening_id")
        .eq("id", data.optionId)
        .maybeSingle(),
      supabaseAdmin
        .from("votes")
        .select("id")
        .eq("option_id", data.optionId)
        .eq("voter_id", voterId)
        .maybeSingle(),
    ]);

    if (screeningResult.error) {
      throw screeningResult.error;
    }

    if (!screeningResult.data || !isPollOpen(screeningResult.data)) {
      throw new Error("Le sondage n’est pas ouvert.");
    }

    if (
      optionResult.error ||
      !optionResult.data ||
      optionResult.data.screening_id !== data.screeningId
    ) {
      throw new Error("Ce film ne fait pas partie de cette séance.");
    }

    if (existingVoteResult.error) {
      throw existingVoteResult.error;
    }

    if (existingVoteResult.data) {
      const { error } = await supabaseAdmin
        .from("votes")
        .delete()
        .eq("id", existingVoteResult.data.id)
        .eq("voter_id", voterId);

      if (error) {
        throw error;
      }

      return { voted: false };
    }

    const { count, error: countError } = await supabaseAdmin
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("screening_id", data.screeningId)
      .eq("voter_id", voterId);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) >= screeningResult.data.votes_per_voter) {
      throw new Error(
        `Vous avez déjà utilisé vos ${screeningResult.data.votes_per_voter} vote(s).`,
      );
    }

    const { error: insertError } = await supabaseAdmin.from("votes").insert({
      option_id: data.optionId,
      screening_id: data.screeningId,
      voter_id: voterId,
    });

    if (insertError) {
      throw insertError;
    }

    return { voted: true };
  });
