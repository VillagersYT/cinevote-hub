import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Trophy } from "lucide-react";

import { getPollState } from "@/lib/poll.functions";
import { getErrorMessage } from "@/lib/supabase-safe";

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
      {
        name: "description",
        content: `Résultats du vote pour la séance ${params.id}`,
      },
      { property: "og:title", content: `Résultats — Séance ${params.id}` },
      {
        property: "og:description",
        content: `Classement des films proposés pour la séance ${params.id}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScreeningResultsPage,
});

function ScreeningResultsPage() {
  const { id } = Route.useParams();
  const pollQuery = useQuery({
    queryKey: ["poll-state", id],
    queryFn: () =>
      getPollState({
        data: {
          screeningId: id,
        },
      }),
    refetchInterval: 15_000,
    retry: 1,
  });
  const poll = pollQuery.data;
  const screening = poll?.screening;
  const totalVotes = poll?.totalVotes ?? 0;

  const rankedOptions = useMemo<RankedOption[]>(() => {
    return [...(poll?.options ?? [])]
      .map((option) => ({
        id: option.id,
        title: option.title,
        release_year: option.release_year,
        tmdb_id: option.tmdb_id,
        voteCount: poll?.voteCounts[option.id] ?? 0,
        rank: 0,
      }))
      .sort((a, b) => b.voteCount - a.voteCount || a.title.localeCompare(b.title))
      .map((option, index) => ({
        ...option,
        rank: index + 1,
      }));
  }, [poll]);

  const exportCsv = () => {
    if (!screening) {
      return;
    }

    const headers = [
      "screening_id",
      "screening_title",
      "option_id",
      "movie_title",
      "tmdb_id",
      "rank",
      "votes_for_movie",
      "percentage",
    ];
    const rows = rankedOptions.map((option) => [
      screening.id,
      screening.title,
      option.id,
      option.title,
      String(option.tmdb_id),
      String(option.rank),
      String(option.voteCount),
      String(totalVotes ? Math.round((option.voteCount / totalVotes) * 100) : 0),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeTitle = screening.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");

    anchor.href = url;
    anchor.download = `resultats-${safeTitle || screening.id}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (pollQuery.isLoading) {
    return <main className="mx-auto max-w-4xl p-8 text-muted-foreground">Chargement…</main>;
  }

  if (pollQuery.error || !screening) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h1 className="text-2xl font-bold">Résultats indisponibles</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {pollQuery.error ? getErrorMessage(pollQuery.error) : "Cette séance n’existe pas."}
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retour aux séances
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/screenings/$id"
        params={{ id }}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au vote
      </Link>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Résultats — {screening.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {rankedOptions.length} film(s) • {totalVotes} vote(s)
            </p>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            disabled={!rankedOptions.length}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        {!rankedOptions.length && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Aucun film proposé pour cette séance.
          </div>
        )}

        {rankedOptions.map((option) => {
          const percentage = totalVotes ? Math.round((option.voteCount / totalVotes) * 100) : 0;
          const isWinner = option.tmdb_id === screening.winner_movie_id;

          return (
            <article
              key={option.id}
              className={`relative overflow-hidden rounded-xl border bg-card p-4 ${
                isWinner ? "border-accent ring-2 ring-accent/30" : "border-border"
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/8"
                style={{ width: `${percentage}%` }}
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
                  {option.voteCount} vote(s) · {percentage}%
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function escapeCsvCell(value: string) {
  const stringValue = String(value ?? "");
  const leadingTrimmed = stringValue.trimStart();
  const needsGuard = ["=", "+", "-", "@"].includes(leadingTrimmed[0] ?? "");
  const normalized = needsGuard ? `'${stringValue}` : stringValue;
  const escaped = normalized.replaceAll('"', '""');

  return `"${escaped}"`;
}
