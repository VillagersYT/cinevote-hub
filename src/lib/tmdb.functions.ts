import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("TMDB_READ_TOKEN missing");
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("language", "fr-FR");
  url.searchParams.set("include_adult", "false");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

export type TMDBMovie = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime?: number;
  vote_average?: number;
};

export const searchMovies = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => z.object({ q: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const res = await tmdb<{ results: TMDBMovie[] }>("/search/movie", {
      query: data.q,
      page: "1",
    });
    // Ensure movies only (endpoint already only returns movies, but filter out anime/documentary if explicitly wanted)
    return res.results.slice(0, 8).map((m) => ({
      id: m.id,
      title: m.title,
      original_title: m.original_title,
      overview: m.overview,
      poster_path: m.poster_path,
      backdrop_path: m.backdrop_path,
      release_year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    }));
  });

export const getMovieDetails = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    return await tmdb<TMDBMovie>(`/movie/${data.id}`);
  });
