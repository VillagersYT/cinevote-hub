import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVoterId } from "@/hooks/use-voter-id";
import { MovieSearch, type MoviePick } from "@/components/movie-search";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar, MapPin, ArrowLeft, Trophy, Plus, Check, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/screenings/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Séance — Ciné-Club` },
      { name: "description", content: `Sondage de la séance ${params.id}` },
    ],
  }),
  component: ScreeningPage,
});

function ScreeningPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const voterId = useVoterId();
  const [proposerName, setProposerName] = useState("");

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

  const myVotes = new Set(
    (votes ?? []).filter((v) => v.voter_id === voterId).map((v) => v.option_id),
  );
  const myProposals = (options ?? []).filter((o) => o.proposer_voter_id === voterId).length;
  const totalVotes = votes?.length ?? 0;
  const isOpen =
    screening?.status === "open" &&
    (!screening.poll_closes_at || new Date(screening.poll_closes_at) > new Date()) &&
    (!screening.poll_opens_at || new Date(screening.poll_opens_at) <= new Date());

  const propose = useMutation({
    mutationFn: async (m: MoviePick) => {
      if (!screening) return;
      if (myProposals >= screening.max_proposals_per_voter) {
        throw new Error(
          `Limite: ${screening.max_proposals_per_voter} proposition(s) par personne.`,
        );
      }
      const { error } = await supabase.from("poll_options").insert({
        screening_id: id,
        tmdb_id: m.id,
        title: m.title,
        original_title: m.original_title,
        overview: m.overview,
        poster_path: m.poster_path,
        backdrop_path: m.backdrop_path,
        release_year: m.release_year,
        proposer_name: proposerName || null,
        proposer_voter_id: voterId,
      });
      if (error) throw new Error(error.code === "23505" ? "Film déjà proposé." : error.message);
    },
    onSuccess: () => {
      toast.success("Film proposé !");
      qc.invalidateQueries({ queryKey: ["options", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vote = useMutation({
    mutationFn: async (optionId: string) => {
      if (!voterId || !screening) return;
      const already = myVotes.has(optionId);
      if (already) {
        const { error } = await supabase
          .from("votes")
          .delete()
          .eq("option_id", optionId)
          .eq("voter_id", voterId);
        if (error) throw new Error(error.message);
      } else {
        if (myVotes.size >= screening.votes_per_voter) {
          throw new Error(`Vous avez déjà utilisé vos ${screening.votes_per_voter} vote(s).`);
        }
        const { error } = await supabase.from("votes").insert({
          option_id: optionId,
          screening_id: id,
          voter_id: voterId,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["votes", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (sLoading)
    return <div className="mx-auto max-w-4xl p-8 text-muted-foreground">Chargement…</div>;
  if (!screening) return null;

  const sortedOptions = [...(options ?? [])].sort((a, b) => {
    const av = votes?.filter((v) => v.option_id === a.id).length ?? 0;
    const bv = votes?.filter((v) => v.option_id === b.id).length ?? 0;
    return bv - av;
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Toutes les séances
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
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
      </div>

      {isOpen && screening.allow_public_proposals && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-1 font-display text-lg font-bold flex items-center gap-2">
            <Plus className="h-4 w-4" /> Proposer un film
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Films uniquement (issus de TMDB). Vous en avez proposé {myProposals}/
            {screening.max_proposals_per_voter}.
          </p>
          <input
            value={proposerName}
            onChange={(e) => setProposerName(e.target.value)}
            placeholder="Votre nom (optionnel)"
            maxLength={40}
            className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <MovieSearch onPick={(m) => propose.mutate(m)} />
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
            Aucun film proposé pour l'instant.
          </div>
        )}
        <div className="space-y-3">
          {sortedOptions.map((o, idx) => {
            const count = votes?.filter((v) => v.option_id === o.id).length ?? 0;
            const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            const voted = myVotes.has(o.id);
            const isWinner = screening.winner_movie_id === o.tmdb_id;
            return (
              <div
                key={o.id}
                className={`relative overflow-hidden rounded-xl border bg-card p-4 transition ${
                  voted ? "border-primary ring-2 ring-primary/30" : "border-border"
                } ${isWinner ? "ring-2 ring-accent" : ""}`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-primary/8 transition-all"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center gap-4">
                  {o.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w154${o.poster_path}`}
                      alt=""
                      className="h-24 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-24 w-16 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {idx === 0 && totalVotes > 0 && <Trophy className="h-4 w-4 text-accent" />}
                      <h3 className="truncate font-semibold">
                        {o.title}
                        {o.release_year && (
                          <span className="ml-1 font-normal text-muted-foreground">
                            ({o.release_year})
                          </span>
                        )}
                      </h3>
                    </div>
                    {o.overview && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {o.overview}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{count} vote(s)</span>
                      <span>· {pct}%</span>
                      {o.proposer_name && <span>· proposé par {o.proposer_name}</span>}
                    </div>
                  </div>
                  {isOpen && (
                    <button
                      onClick={() => vote.mutate(o.id)}
                      disabled={vote.isPending}
                      className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        voted
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-secondary"
                      }`}
                    >
                      {voted ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Voté
                        </span>
                      ) : (
                        "Voter"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
