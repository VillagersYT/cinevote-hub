import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, Trophy } from "lucide-react";

type RankedOption = {
  id: string;
  title: string;
  release_year: number | null;
  tmdb_id: number;
  voteCount: number;
  rank: number;
};

export const Route = createFileRoute("/screenings/$id/results")({
  head: ({ params }) => ({
    meta: [
      { title: `Résultats — Séance ${params.id}` },
      { name: "description", content: `Résultats du vote pour la séance ${params.id}` },
    ],
  }),
  component: ScreeningResultsPage,
});

function ScreeningResultsPage() {
  const { id } = Route.useParams();

  const { data: screening, isLoading: sLoading } = useQuery({
    queryKey: ["screening", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("screenings").select("*").eq("id", id).single();
      if (error) throw notFound();
      return data;
    },
  });

  const { data: options } = useQuery({
    queryKey: ["options", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("poll_options")
        .select("*")
        .eq("screening_id", id)
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: votes } = useQuery({
    queryKey: ["votes", id],
    queryFn: async () => {
      const { data } = await supabase.from("votes").select("*").eq("screening_id", id);
      return data ?? [];
    },
  });

  const rankedOptions = useMemo<RankedOption[]>(() => {
    const counts = new Map<string, number>();
    for (const vote of votes ?? []) {
      counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
    }
    return [...(options ?? [])]
      .map((option) => ({
        id: option.id,
        title: option.title,
        release_year: option.release_year,
        tmdb_id: option.tmdb_id,
        voteCount: counts.get(option.id) ?? 0,
        rank: 0,
      }))
      .sort((a, b) => b.voteCount - a.voteCount || a.title.localeCompare(b.title))
      .map((option, index) => ({
        ...option,
        rank: index + 1,
      }));
  }, [options, votes]);

  const totalVotes = votes?.length ?? 0;

  const exportCsv = () => {
    if (!screening) return;
    const optionsById = new Map(rankedOptions.map((option) => [option.id, option]));
    const headers = [
      "screening_id",
      "screening_title",
      "option_id",
      "movie_title",
      "tmdb_id",
      "rank",
      "votes_for_movie",
      "voter_id",
      "voted_at",
    ];
    const rows = (votes ?? []).map((vote) => {
      const option = optionsById.get(vote.option_id);
      return [
        screening.id,
        screening.title,
        vote.option_id,
        option?.title ?? "",
        String(option?.tmdb_id ?? ""),
        String(option?.rank ?? ""),
        String(option?.voteCount ?? 0),
        vote.voter_id,
        vote.created_at,
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeTitle = screening.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    anchor.href = url;
    anchor.download = `votes-${safeTitle || screening.id}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (sLoading) return <div className="mx-auto max-w-4xl p-8 text-muted-foreground">Chargement…</div>;
  if (!screening) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/screenings/$id"
        params={{ id }}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour au vote
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Résultats — {screening.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {rankedOptions.length} film(s) • {totalVotes} vote(s)
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={!votes?.length}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <section className="mt-8 space-y-3">
        {!rankedOptions.length && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Aucun film proposé pour cette séance.
          </div>
        )}
        {rankedOptions.map((option) => {
          const pct = totalVotes ? Math.round((option.voteCount / totalVotes) * 100) : 0;
          const isWinner = option.tmdb_id === screening.winner_movie_id;
          return (
            <div
              key={option.id}
              className={`relative overflow-hidden rounded-xl border bg-card p-4 ${isWinner ? "border-accent" : "border-border"}`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/8"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {option.rank === 1 && option.voteCount > 0 && (
                      <Trophy className="h-4 w-4 text-accent" />
                    )}
                    <h2 className="truncate font-semibold">
                      #{option.rank} · {option.title}
                      {option.release_year && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({option.release_year})
                        </span>
                      )}
                    </h2>
                  </div>
                </div>
                <div className="shrink-0 text-sm font-medium">
                  {option.voteCount} vote(s) · {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function escapeCsvCell(value: string) {
  const normalized =
    value.startsWith("=") || value.startsWith("+") || value.startsWith("-") || value.startsWith("@")
      ? `'${value}`
      : value;
  const escaped = normalized.replaceAll('"', '""');
  return `"${escaped}"`;
}
