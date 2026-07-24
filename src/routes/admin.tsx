import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, LogOut, Plus, Settings, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Ciné-Club" },
      {
        name: "description",
        content: "Gestion protégée des séances, sondages et paramètres.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: AdminPage,
});

type ScreeningStatus = "open" | "closed" | "finished";

type ScreeningRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  scheduled_at: string | null;
  poll_opens_at: string | null;
  poll_closes_at: string | null;
  allow_public_proposals: boolean;
  max_proposals_per_voter: number;
  votes_per_voter: number;
  status: ScreeningStatus;
  cover_url: string | null;
  winner_movie_id: number | null;
  created_at?: string;
};

type ScreeningForm = {
  id?: string;
  title: string;
  description: string;
  location: string;
  scheduled_at: string;
  poll_opens_at: string;
  poll_closes_at: string;
  allow_public_proposals: boolean;
  max_proposals_per_voter: number;
  votes_per_voter: number;
  status: ScreeningStatus;
  cover_url: string;
  winner_movie_id: number | null;
};

type PollOptionRow = {
  id: string;
  screening_id: string;
  tmdb_id: number;
  title: string;
  release_year: number | null;
};

type SettingsForm = {
  site_name: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
  hero_image_url: string;
  about_text: string;
  footer_text: string;
  default_votes_per_voter: number;
  default_max_proposals: number;
};

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"screenings" | "settings">("screenings");

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          Chargement…
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-2xl font-bold">Connexion requise</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu dois te connecter pour accéder à l’administration.
          </p>
          <a
            href="/auth"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Aller à la connexion
          </a>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-2xl font-bold">Accès refusé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ton compte est connecté, mais il n’a pas le rôle admin.
          </p>

          <button
            type="button"
            onClick={() => {
              void supabase.auth.signOut().then(() => navigate({ to: "/auth" }));
            }}
            className="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Se déconnecter
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gère les séances, les films proposés et les paramètres du site.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void supabase.auth.signOut().then(() => navigate({ to: "/" }));
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>

      <div className="mb-6 flex rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("screenings")}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            tab === "screenings"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-secondary"
          }`}
        >
          <Film className="h-4 w-4" />
          Séances
        </button>

        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            tab === "settings"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-secondary"
          }`}
        >
          <Settings className="h-4 w-4" />
          Paramètres
        </button>
      </div>

      {tab === "screenings" ? <ScreeningsAdmin /> : <SettingsAdmin />}
    </main>
  );
}

function ScreeningsAdmin() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ScreeningForm | null>(null);

  const { data: screenings = [], isLoading } = useQuery({
    queryKey: ["admin_screenings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screenings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as ScreeningRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (screening: ScreeningForm) => {
      const payload = {
        title: screening.title.trim(),
        description: screening.description.trim() || null,
        location: screening.location.trim() || null,
        scheduled_at: toIsoDate(screening.scheduled_at),
        poll_opens_at: toIsoDate(screening.poll_opens_at),
        poll_closes_at: toIsoDate(screening.poll_closes_at),
        allow_public_proposals: screening.allow_public_proposals,
        max_proposals_per_voter: Number(screening.max_proposals_per_voter),
        votes_per_voter: Number(screening.votes_per_voter),
        status: screening.status,
        cover_url: screening.cover_url.trim() || null,
        winner_movie_id: screening.winner_movie_id,
      };

      const { error } = screening.id
        ? await supabase
            .from("screenings")
            .update(payload as any)
            .eq("id", screening.id)
        : await supabase.from("screenings").insert(payload as any);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Séance enregistrée");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin_screenings"] });
      queryClient.invalidateQueries({ queryKey: ["screenings"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (screeningId: string) => {
      const { error } = await supabase
        .from("screenings")
        .delete()
        .eq("id", screeningId);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Séance supprimée");
      queryClient.invalidateQueries({ queryKey: ["admin_screenings"] });
      queryClient.invalidateQueries({ queryKey: ["screenings"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await supabase
        .from("poll_options")
        .delete()
        .eq("id", optionId);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Film supprimé");
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div>
        <button
          type="button"
          onClick={() => setEditing(createEmptyScreening())}
          className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Nouvelle séance
        </button>

        <div className="space-y-3">
          {isLoading && (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Chargement des séances…
            </div>
          )}

          {!isLoading && screenings.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Aucune séance pour le moment.
            </div>
          )}

          {screenings.map((screening) => (
            <article
              key={screening.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(createFormFromScreening(screening))}
                  className="min-w-0 flex-1 text-left"
                >
                  <h2 className="truncate font-semibold">{screening.title}</h2>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {screening.status}
                  </p>
                  {screening.scheduled_at && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {new Date(screening.scheduled_at).toLocaleString("fr-FR")}
                    </p>
                  )}
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`/screenings/${screening.id}`}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                  >
                    Voir
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      const ok = window.confirm("Supprimer cette séance ?");
                      if (ok) {
                        deleteMutation.mutate(screening.id);
                      }
                    }}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                    aria-label="Supprimer la séance"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div>
        {editing ? (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">
              {editing.id ? "Modifier la séance" : "Nouvelle séance"}
            </h2>

            <div className="space-y-3">
              <Field label="Titre">
                <input
                  value={editing.title}
                  onChange={(event) =>
                    setEditing({ ...editing, title: event.target.value })
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Description">
                <textarea
                  rows={3}
                  value={editing.description}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      description: event.target.value,
                    })
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Lieu">
                <input
                  value={editing.location}
                  onChange={(event) =>
                    setEditing({ ...editing, location: event.target.value })
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Image de couverture">
                <input
                  value={editing.cover_url}
                  onChange={(event) =>
                    setEditing({ ...editing, cover_url: event.target.value })
                  }
                  placeholder="https://..."
                  className={inputClassName}
                />
              </Field>

              <Field label="Date de projection">
                <input
                  type="datetime-local"
                  value={editing.scheduled_at}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      scheduled_at: event.target.value,
                    })
                  }
                  className={inputClassName}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ouverture du sondage">
                  <input
                    type="datetime-local"
                    value={editing.poll_opens_at}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        poll_opens_at: event.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Fermeture du sondage">
                  <input
                    type="datetime-local"
                    value={editing.poll_closes_at}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        poll_closes_at: event.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Votes / personne">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editing.votes_per_voter}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        votes_per_voter: Number(event.target.value),
                      })
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Propositions / personne">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editing.max_proposals_per_voter}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        max_proposals_per_voter: Number(event.target.value),
                      })
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Statut">
                  <select
                    value={editing.status}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        status: event.target.value as ScreeningStatus,
                      })
                    }
                    className={inputClassName}
                  >
                    <option value="open">Ouvert</option>
                    <option value="closed">Fermé</option>
                    <option value="finished">Terminé</option>
                  </select>
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.allow_public_proposals}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      allow_public_proposals: event.target.checked,
                    })
                  }
                />
                Autoriser les propositions publiques
              </label>
            </div>

            {editing.id && (
              <ExistingOptions
                screeningId={editing.id}
                winnerId={editing.winner_movie_id}
                onDelete={(optionId) => deleteOptionMutation.mutate(optionId)}
                onWinner={(tmdbId) =>
                  setEditing({ ...editing, winner_movie_id: tmdbId })
                }
              />
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate(editing)}
                disabled={saveMutation.isPending || !editing.title.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Enregistrer
              </button>

              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            Sélectionne une séance ou crée-en une nouvelle.
          </div>
        )}
      </div>
    </section>
  );
}

function ExistingOptions({
  screeningId,
  winnerId,
  onDelete,
  onWinner,
}: {
  screeningId: string;
  winnerId: number | null;
  onDelete: (id: string) => void;
  onWinner: (tmdbId: number) => void;
}) {
  const { data: options = [] } = useQuery({
    queryKey: ["admin_options", screeningId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("poll_options")
        .select("id, screening_id, tmdb_id, title, release_year")
        .eq("screening_id", screeningId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as PollOptionRow[];
    },
  });

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-2 text-sm font-medium">
        Films proposés ({options.length})
      </div>

      <div className="space-y-1.5">
        {options.map((option) => (
          <div
            key={option.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-xs"
          >
            <div className="min-w-0 flex-1 truncate">
              {option.title}
              {option.release_year && (
                <span className="ml-1 text-muted-foreground">
                  ({option.release_year})
                </span>
              )}
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onWinner(option.tmdb_id)}
                className={`rounded p-1 ${
                  winnerId === option.tmdb_id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-secondary"
                }`}
                title="Marquer comme gagnant"
              >
                <Trophy className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onDelete(option.id)}
                className="rounded p-1 text-destructive hover:bg-destructive/10"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Après avoir choisi le gagnant, clique sur “Enregistrer”.
      </p>
    </div>
  );
}

function SettingsAdmin() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });

  useEffect(() => {
    if (form) return;

    if (data) {
      setForm({
        site_name: data.site_name ?? "Ciné-Club",
        tagline: data.tagline ?? "",
        primary_color: data.primary_color ?? "#f97316",
        accent_color: data.accent_color ?? "#fbbf24",
        hero_image_url: data.hero_image_url ?? "",
        about_text: data.about_text ?? "",
        footer_text: data.footer_text ?? "",
        default_votes_per_voter: data.default_votes_per_voter ?? 1,
        default_max_proposals: data.default_max_proposals ?? 3,
      });
      return;
    }

    if (!isLoading) {
      setForm({
        site_name: "Ciné-Club",
        tagline: "Votez pour le prochain film de la séance",
        primary_color: "#f97316",
        accent_color: "#fbbf24",
        hero_image_url: "",
        about_text: "",
        footer_text: "",
        default_votes_per_voter: 1,
        default_max_proposals: 3,
      });
    }
  }, [data, form, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) return;

      const { error } = await supabase.from("site_settings").upsert({
        id: 1,
        site_name: form.site_name,
        tagline: form.tagline || null,
        primary_color: form.primary_color || null,
        accent_color: form.accent_color || null,
        hero_image_url: form.hero_image_url || null,
        about_text: form.about_text || null,
        footer_text: form.footer_text || null,
        default_votes_per_voter: Number(form.default_votes_per_voter),
        default_max_proposals: Number(form.default_max_proposals),
      } as any);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      queryClient.invalidateQueries({ queryKey: ["site_settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin_settings"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (!form) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Chargement des paramètres…
      </div>
    );
  }

  return (
    <section className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">Personnalisation du site</h2>

      <div className="space-y-3">
        <Field label="Nom du site">
          <input
            value={form.site_name}
            onChange={(event) =>
              setForm({ ...form, site_name: event.target.value })
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Accroche">
          <input
            value={form.tagline}
            onChange={(event) =>
              setForm({ ...form, tagline: event.target.value })
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Couleur principale">
          <input
            value={form.primary_color}
            onChange={(event) =>
              setForm({ ...form, primary_color: event.target.value })
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Couleur d'accent">
          <input
            value={form.accent_color}
            onChange={(event) =>
              setForm({ ...form, accent_color: event.target.value })
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Image de hero">
          <input
            value={form.hero_image_url}
            onChange={(event) =>
              setForm({ ...form, hero_image_url: event.target.value })
            }
            placeholder="https://..."
            className={inputClassName}
          />
        </Field>

        <Field label="À propos">
          <textarea
            rows={4}
            value={form.about_text}
            onChange={(event) =>
              setForm({ ...form, about_text: event.target.value })
            }
            className={inputClassName}
          />
        </Field>

        <Field label="Pied de page">
          <input
            value={form.footer_text}
            onChange={(event) =>
              setForm({ ...form, footer_text: event.target.value })
            }
            className={inputClassName}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Votes / personne par défaut">
            <input
              type="number"
              min={1}
              max={50}
              value={form.default_votes_per_voter}
              onChange={(event) =>
                setForm({
                  ...form,
                  default_votes_per_voter: Number(event.target.value),
                })
              }
              className={inputClassName}
            />
          </Field>

          <Field label="Propositions max par défaut">
            <input
              type="number"
              min={1}
              max={50}
              value={form.default_max_proposals}
              onChange={(event) =>
                setForm({
                  ...form,
                  default_max_proposals: Number(event.target.value),
                })
              }
              className={inputClassName}
            />
          </Field>
        </div>
      </div>

      <button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Enregistrer
      </button>
    </section>
  );
}

function createEmptyScreening(): ScreeningForm {
  return {
    id: undefined,
    title: "",
    description: "",
    location: "",
    scheduled_at: "",
    poll_opens_at: "",
    poll_closes_at: "",
    allow_public_proposals: true,
    max_proposals_per_voter: 3,
    votes_per_voter: 1,
    status: "open",
    cover_url: "",
    winner_movie_id: null,
  };
}

function createFormFromScreening(screening: ScreeningRow): ScreeningForm {
  return {
    id: screening.id,
    title: screening.title ?? "",
    description: screening.description ?? "",
    location: screening.location ?? "",
    scheduled_at: toDatetimeLocal(screening.scheduled_at),
    poll_opens_at: toDatetimeLocal(screening.poll_opens_at),
    poll_closes_at: toDatetimeLocal(screening.poll_closes_at),
    allow_public_proposals: screening.allow_public_proposals ?? true,
    max_proposals_per_voter: screening.max_proposals_per_voter ?? 3,
    votes_per_voter: screening.votes_per_voter ?? 1,
    status: screening.status ?? "open",
    cover_url: screening.cover_url ?? "",
    winner_movie_id: screening.winner_movie_id ?? null,
  };
}

function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDate(value: string): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

const inputClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
            }
