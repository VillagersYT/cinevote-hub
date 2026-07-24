import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Vote, ArrowRight } from "lucide-react";

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

function Home() {
  const { data: settings } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });
  const { data: screenings, isLoading } = useQuery({
    queryKey: ["screenings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("screenings")
        .select("*")
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="relative overflow-hidden rounded-3xl bg-hero-gradient p-8 md:p-14 shadow-glow">
        {settings?.hero_image_url && (
          <img
            src={settings.hero_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-overlay"
          />
        )}
        <div className="relative">
          <h1 className="max-w-3xl font-display text-4xl font-bold text-primary-foreground md:text-6xl">
            {settings?.site_name ?? "Ciné-Club"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-foreground/90">
            {settings?.tagline ?? "Votez pour le prochain film de la séance"}
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-6 font-display text-2xl font-bold">Prochaines séances</h2>
        {isLoading && <div className="text-muted-foreground">Chargement…</div>}
        {!isLoading && !screenings?.length && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">Aucune séance programmée pour le moment.</p>
          </div>
        )}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {screenings?.map((s) => (
            <Link
              key={s.id}
              to="/screenings/$id"
              params={{ id: s.id }}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-1 hover:shadow-glow"
            >
              {s.cover_url && (
                <div className="aspect-video overflow-hidden bg-muted">
                  <img
                    src={s.cover_url}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "open"
                        ? "bg-primary/15 text-primary"
                        : s.status === "finished"
                          ? "bg-accent/20 text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.status === "open" ? "Ouvert" : s.status === "finished" ? "Terminé" : "Fermé"}
                  </span>
                </div>
                {s.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                )}
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {s.scheduled_at && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(s.scheduled_at).toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  )}
                  {s.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {s.location}
                    </div>
                  )}
                </div>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  <Vote className="h-3.5 w-3.5" /> Voir le sondage
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {settings?.about_text && (
        <section className="mt-14 rounded-2xl border border-border bg-card p-8">
          <h2 className="mb-3 font-display text-xl font-bold">À propos</h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{settings.about_text}</p>
        </section>
      )}

      <footer className="mt-16 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        {settings?.footer_text ?? "Ciné-Club · Propulsé par TMDB"}
      </footer>
    </main>
  );
}
