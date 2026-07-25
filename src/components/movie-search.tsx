import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";

import { searchTmdbMovies } from "@/lib/poll.functions";
import type { MoviePick } from "@/lib/movie-types";

export type { MoviePick } from "@/lib/movie-types";

export function MovieSearch({ onPick }: { onPick: (m: MoviePick) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MoviePick[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    timeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await searchTmdbMovies({
          data: {
            query: q.trim(),
          },
        });
        setResults(res);
        setOpen(true);
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : "Recherche impossible.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [q]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Chercher un film…"
          className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 max-h-96 w-full overflow-auto rounded-lg border border-border bg-popover shadow-xl">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onPick(m);
                setQ("");
                setResults([]);
                setOpen(false);
              }}
              className="flex w-full items-start gap-3 border-b border-border p-3 text-left last:border-b-0 hover:bg-secondary"
            >
              {m.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                  alt=""
                  className="h-16 w-11 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-16 w-11 flex-shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.title}</div>
                <div className="text-xs text-muted-foreground">{m.release_year ?? "—"}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {m.overview}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
