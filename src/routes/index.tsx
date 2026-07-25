import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowRight, Calendar, MapPin, Vote } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ciné-Club — Prochaines séances" },
      {
        name: "description",
        content: "Découvrez les prochaines séances et votez pour le film à projeter.",
      },
      { property: "og:title", content: "Ciné-Club — Prochaines séances" },
      {
        property: "og:description",
        content: "Proposez un film via TMDB, votez, et choisissez la prochaine projection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "Erreur inconnue.";
}

async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} a expiré après ${Math.round(timeoutMs / 1000)} secondes.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(operation), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getScreeningStatusLabel(status: string): string {
  if (status === "open") {
    return "Ouvert";
  }

  if (status === "finished") {
    return "Terminé";
  }

  if (status === "closed") {
    return "Fermé";
  }

  return status;
}

function Home() {
  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
        10_000,
        "Chargement des réglages du site",
      );

      if (error) {
        throw error;
      }

      return data;
    },
    retry: 1,
  });

  const {
    data: screenings = [],
    isLoading: screeningsLoading,
    error: screeningsError,
  } = useQuery({
    queryKey: ["screenings"],
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from("screenings")
          .select("*")
          .order("scheduled_at", { ascending: true, nullsFirst: false }),
        10_000,
        "Chargement des séances",
      );

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    retry: 1,
  });

  const isLoading = settingsLoading || screeningsLoading;
  const supabaseError = settingsError ?? screeningsError;

  return (
    <main className="min-h-screen">
      <section className="container mx-auto max-w-5xl px-4 py-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-hero-gradient p-8 shadow-glow sm:p-10">
          {settings?.hero_image_url && (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center opacity-25"
              style={{
                backgroundImage: `url(${settings.hero_image_url})`,
              }}
            />
          )}

          <div className="relative max-w-2xl">
            <h1 className="text-4xl font-black tracking-tight text-black sm:text-5xl">
              {settings?.site_name ?? "Ciné-Club"}
            </h1>

            <p className="mt-6 max-w-xl text-xl leading-relaxed text-black/80">
              {settings?.tagline ?? "Votez pour le prochain film de la séance"}
            </p>
          </div>
        </div>

        <aside className="mt-6 flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />

          <div>
            <p className="font-semibold">À propos des films très récents</p>

            <p className="mt-1 leading-relaxed text-muted-foreground">
              Les films sortis au cours des trois derniers mois sont difficiles à obtenir et les
              versions disponibles sont souvent de mauvaise qualité. Pour une meilleure séance,
              privilégiez un film sorti depuis plus de trois mois.
            </p>
          </div>
        </aside>

        <section className="mt-12">
          <div className="flex items-center gap-3">
            <Vote className="size-8 text-primary" aria-hidden="true" />

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Prochaines séances</h2>
          </div>

          {supabaseError && (
            <div className="mt-5 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />

              <div>
                <p className="font-semibold">Impossible de charger les données Supabase.</p>

                <p className="mt-1">{getErrorMessage(supabaseError)}</p>
              </div>
            </div>
          )}

          {isLoading && !supabaseError && <p className="mt-5 text-muted-foreground">Chargement…</p>}

          {!isLoading && !supabaseError && screenings.length === 0 && (
            <p className="mt-5 text-muted-foreground">Aucune séance programmée pour le moment.</p>
          )}

          {!supabaseError && screenings.length > 0 && (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {screenings.map((screening) => (
                <article
                  key={screening.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {screening.cover_url && (
                    <img
                      src={screening.cover_url}
                      alt=""
                      className="h-44 w-full object-cover"
                      loading="lazy"
                    />
                  )}

                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                        {getScreeningStatusLabel(screening.status)}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {screening.votes_per_voter} vote
                        {screening.votes_per_voter > 1 ? "s" : ""} / personne
                      </span>
                    </div>

                    <h3 className="text-xl font-bold tracking-tight">{screening.title}</h3>

                    {screening.description && (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {screening.description}
                      </p>
                    )}

                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {screening.scheduled_at && (
                        <p className="flex items-center gap-2">
                          <Calendar className="size-4" aria-hidden="true" />

                          <span>
                            {new Date(screening.scheduled_at).toLocaleString("fr-FR", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </p>
                      )}

                      {screening.location && (
                        <p className="flex items-center gap-2">
                          <MapPin className="size-4" aria-hidden="true" />

                          <span>{screening.location}</span>
                        </p>
                      )}
                    </div>

                    <Link
                      to="/screenings/$id"
                      params={{ id: screening.id }}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Voir le sondage
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {settings?.about_text && (
          <section className="mt-12 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-2xl font-bold tracking-tight">À propos</h2>

            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
              {settings.about_text}
            </p>
          </section>
        )}

        <footer className="mt-12 border-t border-border py-8 text-center text-sm text-muted-foreground">
          {settings?.footer_text ?? "Ciné-Club · Propulsé par TMDB"}
        </footer>
      </section>
    </main>
  );
}
