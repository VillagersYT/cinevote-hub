import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Calendar, Check, MapPin, Plus, Trophy } from "lucide-react";
import { toast } from "sonner";

import { MovieSearch, type MoviePick } from "@/components/movie-search";
import { getPollState, proposeMovie, toggleVote } from "@/lib/poll.functions";
import { getErrorMessage } from "@/lib/supabase-safe";

export const Route = createFileRoute("/screenings/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Séance — Ciné-Club" },
      { name: "description", content: `Sondage de la séance ${params.id}` },
      { property: "og:title", content: "Séance — Ciné-Club" },
      {
        property: "og:description",
        content: `Proposez et votez pour le film de la séance ${params.id}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScreeningPage,
});

function ScreeningPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [proposerName, setProposerName] = useState("");

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
  const options = poll?.options ?? [];
  const voteCounts = poll?.voteCounts ?? {};
  const myVotes = new Set(poll?.myVotes ?? []);
  const totalVotes = poll?.totalVotes ?? 0;
  const myProposals = poll?.myProposalCount ?? 0;

  const propose = useMutation({
    mutationFn: (movie: MoviePick) =>
      proposeMovie({
        data: {
          proposerName,
          screeningId: id,
          tmdbId: movie.id,
        },
      }),
    onSuccess: async () => {
      setProposerName("");
      toast.success("Film proposé !");
      await queryClient.invalidateQueries({
        queryKey: ["poll-state", id],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const vote = useMutation({
    mutationFn: (optionId: string) =>
      toggleVote({
        data: {
          optionId,
          screeningId: id,
        },
      }),
    onSuccess: async (result) => {
      toast.success(result.voted ? "Vote enregistré." : "Vote retiré.");
      await queryClient.invalidateQueries({
        queryKey: ["poll-state", id],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  if (pollQuery.isLoading) {
    return <main className="mx-auto max-w-4xl p-8 text-muted-foreground">Chargement…</main>;
  }

  if (pollQuery.error || !screening) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6">
          <h1 className="text-2xl font-bold">Séance indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">{getErrorMessage(pollQuery.error)}</p>
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

  const now = Date.now();
  const isOpen =
    screening.status === "open" &&
    (!screening.poll_closes_at || new Date(screening.poll_closes_at).getTime() > now) &&
    (!screening.poll_opens_at || new Date(screening.poll_opens_at).getTime() <= now);
  const sortedOptions = [...options].sort((a, b) => {
    const voteDifference = (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0);

    return voteDifference || a.title.localeCompare(b.title);
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Toutes les séances
      </Link>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">{screening.title}</h1>
            <Link
              to="/screenings/$id/results"
              params={{ id }}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <BarChart3 className="h-4 w-4" />
              Voir les résultats
            </Link>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              isOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {isOpen ? "Sondage ouvert" : "Sondage fermé"}
          </span>
        </div>

        {screening.description && (
          <p className="mt-2 text-muted-foreground">{screening.description}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {screening.scheduled_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(screening.scheduled_at).toLocaleString("fr-FR", {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </div>
          )}

          {screening.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {screening.location}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-secondary px-2.5 py-1">
            {screening.votes_per_voter} vote(s) par personne
          </span>

          {screening.allow_public_proposals && (
            <span className="rounded-full bg-secondary px-2.5 py-1">
              {screening.max_proposals_per_voter} proposition(s) max
            </span>
          )}

          <span className="rounded-full bg-secondary px-2.5 py-1">
            {totalVotes} vote(s) au total
          </span>
        </div>
      </section>

      {isOpen && screening.allow_public_proposals && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
            <Plus className="h-4 w-4" />
            Proposer un film
          </h2>

          <p className="mb-4 text-sm text-muted-foreground">
            Films uniquement, sans animation ni documentaire. Vous en avez proposé {myProposals}/
            {screening.max_proposals_per_voter}.
          </p>

          <input
            value={proposerName}
            onChange={(event) => setProposerName(event.target.value)}
            placeholder="Votre nom (optionnel)"
            maxLength={40}
            disabled={propose.isPending}
            className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />

          <MovieSearch
            onPick={(movie) => {
              if (!propose.isPending) {
                propose.mutate(movie);
              }
            }}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-4 font-display text-xl font-bold">
          Sondage{" "}
          {screening.votes_per_voter > 1 &&
            `(${myVotes.size}/${screening.votes_per_voter} utilisés)`}
        </h2>

        {!sortedOptions.length && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Aucun film proposé pour l’instant.
          </div>
        )}

        <div className="space-y-3">
          {sortedOptions.map((option, index) => {
            const count = voteCounts[option.id] ?? 0;
            const percentage = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            const voted = myVotes.has(option.id);
            const isWinner = screening.winner_movie_id === option.tmdb_id;

            return (
              <article
                key={option.id}
                className={`relative overflow-hidden rounded-xl border bg-card p-4 transition ${
                  voted ? "border-primary ring-2 ring-primary/30" : "border-border"
                } ${isWinner ? "ring-2 ring-accent" : ""}`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-primary/8 transition-all"
                  style={{ width: `${percentage}%` }}
                />

                <div className="relative flex items-center gap-4">
                  {option.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w154${option.poster_path}`}
                      alt=""
                      className="h-24 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-24 w-16 shrink-0 rounded-md bg-muted" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {index === 0 && totalVotes > 0 && <Trophy className="h-4 w-4 text-accent" />}

                      <h3 className="truncate font-semibold">
                        {option.title}
                        {option.release_year && (
                          <span className="ml-1 font-normal text-muted-foreground">
                            ({option.release_year})
                          </span>
                        )}
                      </h3>
                    </div>

                    {option.overview && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {option.overview}
                      </p>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{count} vote(s)</span>
                      <span>· {percentage}%</span>
                      {option.proposer_name && <span>· proposé par {option.proposer_name}</span>}
                    </div>
                  </div>

                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => vote.mutate(option.id)}
                      disabled={vote.isPending}
                      className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${
                        voted
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-secondary"
                      }`}
                    >
                      {voted ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          Voté
                        </span>
                      ) : (
                        "Voter"
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
