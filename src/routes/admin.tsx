import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Copy,
  ExternalLink,
  Film,
  ListChecks,
  LogOut,
  Palette,
  PauseCircle,
  Pencil,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { MovieSearch, type MoviePick } from "@/components/movie-search";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/supabase-safe";

type Screening = Tables<"screenings">;
type SiteSettings = Tables<"site_settings">;
type AdminTab = "screenings" | "content" | "settings";

type ScreeningDraft = {
  allow_public_proposals: boolean;
  cover_url: string;
  description: string;
  location: string;
  max_proposals_per_voter: number;
  poll_closes_at: string;
  poll_opens_at: string;
  scheduled_at: string;
  status: string;
  title: string;
  votes_per_voter: number;
};

type SettingsDraft = {
  about_text: string;
  accent_color: string;
  default_max_proposals: number;
  default_votes_per_voter: number;
  footer_text: string;
  hero_image_url: string;
  primary_color: string;
  site_name: string;
  tagline: string;
};

const fieldClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
const labelClassName = "block space-y-2 text-sm font-medium";

const defaultSettings: SettingsDraft = {
  about_text: "",
  accent_color: "#fbbf24",
  default_max_proposals: 3,
  default_votes_per_voter: 1,
  footer_text: "Ciné-Club · Propulsé par TMDB",
  hero_image_url: "",
  primary_color: "#f97316",
  site_name: "Ciné-Club",
  tagline: "Votez pour le prochain film de la séance",
};

function createEmptyScreeningDraft(
  settings?: Pick<SiteSettings, "default_max_proposals" | "default_votes_per_voter"> | null,
): ScreeningDraft {
  return {
    allow_public_proposals: true,
    cover_url: "",
    description: "",
    location: "",
    max_proposals_per_voter: settings?.default_max_proposals ?? 3,
    poll_closes_at: "",
    poll_opens_at: "",
    scheduled_at: "",
    status: "open",
    title: "",
    votes_per_voter: settings?.default_votes_per_voter ?? 1,
  };
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function screeningToDraft(screening: Screening): ScreeningDraft {
  return {
    allow_public_proposals: screening.allow_public_proposals,
    cover_url: screening.cover_url ?? "",
    description: screening.description ?? "",
    location: screening.location ?? "",
    max_proposals_per_voter: screening.max_proposals_per_voter,
    poll_closes_at: toDateTimeLocal(screening.poll_closes_at),
    poll_opens_at: toDateTimeLocal(screening.poll_opens_at),
    scheduled_at: toDateTimeLocal(screening.scheduled_at),
    status: screening.status,
    title: screening.title,
    votes_per_voter: screening.votes_per_voter,
  };
}

function settingsToDraft(settings: SiteSettings): SettingsDraft {
  return {
    about_text: settings.about_text ?? "",
    accent_color: settings.accent_color ?? "#fbbf24",
    default_max_proposals: settings.default_max_proposals,
    default_votes_per_voter: settings.default_votes_per_voter,
    footer_text: settings.footer_text ?? "",
    hero_image_url: settings.hero_image_url ?? "",
    primary_color: settings.primary_color ?? "#f97316",
    site_name: settings.site_name,
    tagline: settings.tagline ?? "",
  };
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Ciné-Club" },
      {
        name: "description",
        content: "Gestion complète du ciné-club.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading, error: authError } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("screenings");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedScreeningId, setSelectedScreeningId] = useState<string | null>(null);
  const [screeningDraft, setScreeningDraft] = useState<ScreeningDraft>(createEmptyScreeningDraft());
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(defaultSettings);

  const settingsQuery = useQuery({
    queryKey: ["site_settings"],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const screeningsQuery = useQuery({
    queryKey: ["admin-screenings"],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screenings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  const contentQuery = useQuery({
    queryKey: ["admin-screening-content", selectedScreeningId],
    enabled: Boolean(user && selectedScreeningId),
    queryFn: async () => {
      if (!selectedScreeningId) {
        return { options: [], votes: [] };
      }

      const [optionsResult, votesResult] = await Promise.all([
        supabase
          .from("poll_options")
          .select("*")
          .eq("screening_id", selectedScreeningId)
          .order("created_at"),
        supabase.from("votes").select("*").eq("screening_id", selectedScreeningId),
      ]);

      if (optionsResult.error) {
        throw optionsResult.error;
      }

      if (votesResult.error) {
        throw votesResult.error;
      }

      return {
        options: optionsResult.data ?? [],
        votes: votesResult.data ?? [],
      };
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettingsDraft(settingsToDraft(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const screenings = screeningsQuery.data ?? [];
  const selectedScreening = screenings.find((screening) => screening.id === selectedScreeningId);
  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const vote of contentQuery.data?.votes ?? []) {
      counts[vote.option_id] = (counts[vote.option_id] ?? 0) + 1;
    }

    return counts;
  }, [contentQuery.data?.votes]);

  const resetScreeningForm = () => {
    setEditingId(null);
    setScreeningDraft(createEmptyScreeningDraft(settingsQuery.data));
  };

  const saveScreening = useMutation({
    mutationFn: async () => {
      const title = screeningDraft.title.trim();

      if (!title) {
        throw new Error("Le titre de la séance est obligatoire.");
      }

      const pollOpensAt = toIsoOrNull(screeningDraft.poll_opens_at);
      const pollClosesAt = toIsoOrNull(screeningDraft.poll_closes_at);

      if (pollOpensAt && pollClosesAt && new Date(pollOpensAt) >= new Date(pollClosesAt)) {
        throw new Error("La fermeture du sondage doit être après son ouverture.");
      }

      const payload = {
        allow_public_proposals: screeningDraft.allow_public_proposals,
        cover_url: emptyToNull(screeningDraft.cover_url),
        description: emptyToNull(screeningDraft.description),
        location: emptyToNull(screeningDraft.location),
        max_proposals_per_voter: Math.max(0, Math.min(20, screeningDraft.max_proposals_per_voter)),
        poll_closes_at: pollClosesAt,
        poll_opens_at: pollOpensAt,
        scheduled_at: toIsoOrNull(screeningDraft.scheduled_at),
        status: screeningDraft.status,
        title,
        votes_per_voter: Math.max(1, Math.min(10, screeningDraft.votes_per_voter)),
      };

      if (editingId) {
        const { error } = await supabase.from("screenings").update(payload).eq("id", editingId);

        if (error) {
          throw error;
        }

        return editingId;
      }

      const { data, error } = await supabase
        .from("screenings")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    },
    onSuccess: async (screeningId) => {
      toast.success(editingId ? "Séance modifiée." : "Séance créée.");
      setSelectedScreeningId(screeningId);
      resetScreeningForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-screenings"] }),
        queryClient.invalidateQueries({ queryKey: ["screenings"] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteScreening = useMutation({
    mutationFn: async (screeningId: string) => {
      const { error } = await supabase.from("screenings").delete().eq("id", screeningId);

      if (error) {
        throw error;
      }

      return screeningId;
    },
    onSuccess: async (screeningId) => {
      if (selectedScreeningId === screeningId) {
        setSelectedScreeningId(null);
      }

      if (editingId === screeningId) {
        resetScreeningForm();
      }

      toast.success("Séance supprimée.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-screenings"] }),
        queryClient.invalidateQueries({ queryKey: ["screenings"] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const duplicateScreening = useMutation({
    mutationFn: async (screening: Screening) => {
      const { data, error } = await supabase
        .from("screenings")
        .insert({
          allow_public_proposals: screening.allow_public_proposals,
          cover_url: screening.cover_url,
          description: screening.description,
          location: screening.location,
          max_proposals_per_voter: screening.max_proposals_per_voter,
          poll_closes_at: null,
          poll_opens_at: null,
          scheduled_at: null,
          status: "closed",
          title: `${screening.title} — copie`,
          votes_per_voter: screening.votes_per_voter,
          winner_movie_id: null,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    },
    onSuccess: async (screeningId) => {
      setSelectedScreeningId(screeningId);
      toast.success("Séance dupliquée.");
      await queryClient.invalidateQueries({
        queryKey: ["admin-screenings"],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ screeningId, status }: { screeningId: string; status: string }) => {
      const { error } = await supabase.from("screenings").update({ status }).eq("id", screeningId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Statut mis à jour.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-screenings"] }),
        queryClient.invalidateQueries({ queryKey: ["screenings"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin-screening-content", selectedScreeningId],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const siteName = settingsDraft.site_name.trim();

      if (!siteName) {
        throw new Error("Le nom du site est obligatoire.");
      }

      const { error } = await supabase.from("site_settings").upsert({
        about_text: emptyToNull(settingsDraft.about_text),
        accent_color: settingsDraft.accent_color || "#fbbf24",
        default_max_proposals: Math.max(0, Math.min(20, settingsDraft.default_max_proposals)),
        default_votes_per_voter: Math.max(1, Math.min(10, settingsDraft.default_votes_per_voter)),
        footer_text: emptyToNull(settingsDraft.footer_text),
        hero_image_url: emptyToNull(settingsDraft.hero_image_url),
        id: 1,
        primary_color: settingsDraft.primary_color || "#f97316",
        site_name: siteName,
        tagline: emptyToNull(settingsDraft.tagline),
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Personnalisation enregistrée.");
      await queryClient.invalidateQueries({ queryKey: ["site_settings"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const addAdminMovie = useMutation({
    mutationFn: async (movie: MoviePick) => {
      if (!selectedScreeningId) {
        throw new Error("Sélectionne d’abord une séance.");
      }

      const { error } = await supabase.from("poll_options").insert({
        backdrop_path: movie.backdrop_path,
        original_title: movie.original_title,
        overview: movie.overview,
        poster_path: movie.poster_path,
        proposer_name: "Administration",
        proposer_voter_id: null,
        release_year: movie.release_year,
        runtime: movie.runtime,
        screening_id: selectedScreeningId,
        title: movie.title,
        tmdb_id: movie.id,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Ce film est déjà présent dans cette séance.");
        }

        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Film ajouté.");
      await queryClient.invalidateQueries({
        queryKey: ["admin-screening-content", selectedScreeningId],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteOption = useMutation({
    mutationFn: async ({ optionId, tmdbId }: { optionId: string; tmdbId: number }) => {
      const { error } = await supabase.from("poll_options").delete().eq("id", optionId);

      if (error) {
        throw error;
      }

      if (selectedScreening?.winner_movie_id === tmdbId) {
        const { error: winnerError } = await supabase
          .from("screenings")
          .update({ winner_movie_id: null })
          .eq("id", selectedScreening.id);

        if (winnerError) {
          throw winnerError;
        }
      }
    },
    onSuccess: async () => {
      toast.success("Film retiré.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin-screening-content", selectedScreeningId],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin-screenings"] }),
      ]);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const setWinner = useMutation({
    mutationFn: async (tmdbId: number | null) => {
      if (!selectedScreeningId) {
        throw new Error("Aucune séance sélectionnée.");
      }

      const { error } = await supabase
        .from("screenings")
        .update({ winner_movie_id: tmdbId })
        .eq("id", selectedScreeningId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Film gagnant mis à jour.");
      await queryClient.invalidateQueries({
        queryKey: ["admin-screenings"],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resetVotes = useMutation({
    mutationFn: async () => {
      if (!selectedScreeningId) {
        throw new Error("Aucune séance sélectionnée.");
      }

      const { error } = await supabase
        .from("votes")
        .delete()
        .eq("screening_id", selectedScreeningId);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Tous les votes ont été supprimés.");
      await queryClient.invalidateQueries({
        queryKey: ["admin-screening-content", selectedScreeningId],
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error("[admin] sign out failed:", signOutError);
    } finally {
      await navigate({ to: "/auth", replace: true });
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-muted-foreground">Chargement de l’administration…</p>
      </main>
    );
  }

  if (authError) {
    return <AdminAccessMessage title="Erreur d’authentification" message={authError} />;
  }

  if (!user) {
    return (
      <AdminAccessMessage
        title="Connexion requise"
        message="Connecte-toi pour accéder à l’administration."
      />
    );
  }

  const queryError = settingsQuery.error ?? screeningsQuery.error ?? contentQuery.error;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Séances, sondages, films, votes et apparence du site.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connecté : {user.email ?? "compte Supabase"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <ExternalLink className="size-4" />
            Voir le site
          </Link>

          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <LogOut className="size-4" />
            Déconnexion
          </button>
        </div>
      </header>

      <nav className="mt-6 grid gap-2 rounded-2xl border border-border bg-card p-2 sm:grid-cols-3">
        <AdminTabButton
          active={activeTab === "screenings"}
          icon={<CalendarDays className="size-4" />}
          label="Séances"
          onClick={() => setActiveTab("screenings")}
        />
        <AdminTabButton
          active={activeTab === "content"}
          icon={<ListChecks className="size-4" />}
          label="Films et votes"
          onClick={() => setActiveTab("content")}
        />
        <AdminTabButton
          active={activeTab === "settings"}
          icon={<Palette className="size-4" />}
          label="Personnalisation"
          onClick={() => setActiveTab("settings")}
        />
      </nav>

      {queryError && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {getErrorMessage(queryError)}
        </div>
      )}

      {activeTab === "screenings" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId ? "Modifier la séance" : "Nouvelle séance"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tous les paramètres du sondage sont configurables.
                </p>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetScreeningForm}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
                >
                  Annuler
                </button>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveScreening.mutate();
              }}
              className="mt-5 space-y-4"
            >
              <label className={labelClassName}>
                <span>Titre *</span>
                <input
                  value={screeningDraft.title}
                  onChange={(event) =>
                    setScreeningDraft((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  required
                  maxLength={120}
                  className={fieldClassName}
                />
              </label>

              <label className={labelClassName}>
                <span>Description</span>
                <textarea
                  value={screeningDraft.description}
                  onChange={(event) =>
                    setScreeningDraft((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={1000}
                  className={fieldClassName}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClassName}>
                  <span>Lieu</span>
                  <input
                    value={screeningDraft.location}
                    onChange={(event) =>
                      setScreeningDraft((previous) => ({
                        ...previous,
                        location: event.target.value,
                      }))
                    }
                    maxLength={160}
                    className={fieldClassName}
                  />
                </label>

                <label className={labelClassName}>
                  <span>Date de diffusion</span>
                  <input
                    type="datetime-local"
                    value={screeningDraft.scheduled_at}
                    onChange={(event) =>
                      setScreeningDraft((previous) => ({
                        ...previous,
                        scheduled_at: event.target.value,
                      }))
                    }
                    className={fieldClassName}
                  />
                </label>
              </div>

              <label className={labelClassName}>
                <span>URL de l’image de couverture</span>
                <input
                  type="url"
                  value={screeningDraft.cover_url}
                  onChange={(event) =>
                    setScreeningDraft((previous) => ({
                      ...previous,
                      cover_url: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className={fieldClassName}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClassName}>
                  <span>Ouverture du sondage</span>
                  <input
                    type="datetime-local"
                    value={screeningDraft.poll_opens_at}
                    onChange={(event) =>
                      setScreeningDraft((previous) => ({
                        ...previous,
                        poll_opens_at: event.target.value,
                      }))
                    }
                    className={fieldClassName}
                  />
                </label>

                <label className={labelClassName}>
                  <span>Fermeture du sondage</span>
                  <input
                    type="datetime-local"
                    value={screeningDraft.poll_closes_at}
                    onChange={(event) =>
                      setScreeningDraft((previous) => ({
                        ...previous,
                        poll_closes_at: event.target.value,
                      }))
                    }
                    className={fieldClassName}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className={labelClassName}>
                  <span>Statut</span>
                  <select
                    value={screeningDraft.status}
                    onChange={(event) =>
                      setScreeningDraft((previous) => ({
                        ...previous,
                        status: event.target.value,
                      }))
                    }
                    className={fieldClassName}
                  >
                    <option value="open">Ouvert</option>
                    <option value="closed">Fermé</option>
                    <option value="finished">Terminé</option>
                  </select>
                </label>

                <label className={labelClassName}>
                  <span>Votes/personne</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={screeningDraft.votes_per_voter}
                    onChange={(event) =>
                      setScreeningDraft((previous) => ({
                        ...previous,
                        votes_per_voter: Number(event.target.value),
                      }))
                    }
                    className={fieldClassName}
                  />
                </label>

                <label className={labelClassName}>
                  <span>Propositions/personne</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={screeningDraft.max_proposals_per_voter}
                    onChange={(event) =>
                      setScreeningDraft((previous) => ({
                        ...previous,
                        max_proposals_per_voter: Number(event.target.value),
                      }))
                    }
                    className={fieldClassName}
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={screeningDraft.allow_public_proposals}
                  onChange={(event) =>
                    setScreeningDraft((previous) => ({
                      ...previous,
                      allow_public_proposals: event.target.checked,
                    }))
                  }
                  className="size-4"
                />
                Autoriser les visiteurs à proposer des films
              </label>

              <button
                type="submit"
                disabled={saveScreening.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Save className="size-4" />
                {saveScreening.isPending
                  ? "Enregistrement…"
                  : editingId
                    ? "Enregistrer les modifications"
                    : "Créer la séance"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Toutes les séances</h2>
                <p className="mt-1 text-sm text-muted-foreground">{screenings.length} séance(s)</p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void queryClient.invalidateQueries({
                    queryKey: ["admin-screenings"],
                  })
                }
                className="rounded-lg border border-border p-2 hover:bg-secondary"
                aria-label="Actualiser"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>

            {screeningsQuery.isLoading && (
              <p className="mt-5 text-sm text-muted-foreground">Chargement…</p>
            )}

            {!screeningsQuery.isLoading && screenings.length === 0 && (
              <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Crée ta première séance avec le formulaire.
              </div>
            )}

            <div className="mt-5 space-y-3">
              {screenings.map((screening) => (
                <article
                  key={screening.id}
                  className={`rounded-xl border p-4 ${
                    selectedScreeningId === screening.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{screening.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Statut : {screening.status}
                        {screening.scheduled_at &&
                          ` · ${new Date(screening.scheduled_at).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}`}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        screening.status === "open"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {screening.status === "open" ? "Ouvert" : "Fermé"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScreeningId(screening.id);
                        setActiveTab("content");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    >
                      <Film className="size-3.5" />
                      Gérer
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(screening.id);
                        setScreeningDraft(screeningToDraft(screening));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary"
                    >
                      <Pencil className="size-3.5" />
                      Modifier
                    </button>

                    <button
                      type="button"
                      onClick={() => duplicateScreening.mutate(screening)}
                      disabled={duplicateScreening.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-60"
                    >
                      <Copy className="size-3.5" />
                      Dupliquer
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({
                          screeningId: screening.id,
                          status: screening.status === "open" ? "closed" : "open",
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary"
                    >
                      {screening.status === "open" ? (
                        <PauseCircle className="size-3.5" />
                      ) : (
                        <PlayCircle className="size-3.5" />
                      )}
                      {screening.status === "open" ? "Fermer" : "Ouvrir"}
                    </button>

                    <Link
                      to="/screenings/$id"
                      params={{ id: screening.id }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary"
                    >
                      <ExternalLink className="size-3.5" />
                      Voir
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Supprimer définitivement « ${screening.title} » et tous ses votes ?`,
                          )
                        ) {
                          deleteScreening.mutate(screening.id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "content" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="block flex-1 space-y-2 text-sm font-medium">
              <span>Séance à gérer</span>
              <select
                value={selectedScreeningId ?? ""}
                onChange={(event) => setSelectedScreeningId(event.target.value || null)}
                className={fieldClassName}
              >
                <option value="">Choisir une séance…</option>
                {screenings.map((screening) => (
                  <option key={screening.id} value={screening.id}>
                    {screening.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedScreening && (
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/screenings/$id"
                  params={{ id: selectedScreening.id }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
                >
                  <ExternalLink className="size-4" />
                  Sondage
                </Link>
                <Link
                  to="/screenings/$id/results"
                  params={{ id: selectedScreening.id }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
                >
                  <ListChecks className="size-4" />
                  Résultats
                </Link>
              </div>
            )}
          </div>

          {!selectedScreening && (
            <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Sélectionne une séance pour gérer ses films et ses votes.
            </div>
          )}

          {selectedScreening && (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <AdminStat label="Films" value={contentQuery.data?.options.length ?? 0} />
                <AdminStat label="Votes" value={contentQuery.data?.votes.length ?? 0} />
                <AdminStat
                  label="Gagnant"
                  value={
                    contentQuery.data?.options.find(
                      (option) => option.tmdb_id === selectedScreening.winner_movie_id,
                    )?.title ?? "Non défini"
                  }
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="space-y-5">
                  <section className="rounded-xl border border-border p-5">
                    <h2 className="font-semibold">Ajouter un film</h2>
                    <p className="mb-4 mt-1 text-sm text-muted-foreground">
                      Recherche TMDB filtrée : films uniquement, sans animation ni documentaire.
                    </p>
                    <MovieSearch
                      onPick={(movie) => {
                        if (!addAdminMovie.isPending) {
                          addAdminMovie.mutate(movie);
                        }
                      }}
                    />
                  </section>

                  <section className="rounded-xl border border-destructive/30 p-5">
                    <h2 className="font-semibold">Actions sur les votes</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      La remise à zéro supprime définitivement tous les votes de cette séance.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Supprimer définitivement tous les votes de cette séance ?",
                          )
                        ) {
                          resetVotes.mutate();
                        }
                      }}
                      disabled={resetVotes.isPending || !contentQuery.data?.votes.length}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <RotateCcw className="size-4" />
                      Réinitialiser les votes
                    </button>
                  </section>
                </div>

                <section className="rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Films du sondage</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Définis le gagnant ou retire une proposition.
                      </p>
                    </div>

                    {selectedScreening.winner_movie_id && (
                      <button
                        type="button"
                        onClick={() => setWinner.mutate(null)}
                        className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary"
                      >
                        Retirer le gagnant
                      </button>
                    )}
                  </div>

                  {contentQuery.isLoading && (
                    <p className="mt-5 text-sm text-muted-foreground">Chargement…</p>
                  )}

                  {!contentQuery.isLoading && !contentQuery.data?.options.length && (
                    <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Aucun film dans cette séance.
                    </div>
                  )}

                  <div className="mt-5 space-y-3">
                    {contentQuery.data?.options
                      .slice()
                      .sort((a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0))
                      .map((option) => {
                        const winner = selectedScreening.winner_movie_id === option.tmdb_id;

                        return (
                          <article
                            key={option.id}
                            className={`flex gap-3 rounded-xl border p-3 ${
                              winner ? "border-accent ring-2 ring-accent/20" : "border-border"
                            }`}
                          >
                            {option.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${option.poster_path}`}
                                alt=""
                                className="h-20 w-14 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="h-20 w-14 shrink-0 rounded bg-muted" />
                            )}

                            <div className="min-w-0 flex-1">
                              <h3 className="truncate font-medium">
                                {option.title}
                                {option.release_year && ` (${option.release_year})`}
                              </h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {voteCounts[option.id] ?? 0} vote(s)
                                {option.proposer_name && ` · ${option.proposer_name}`}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setWinner.mutate(winner ? null : option.tmdb_id)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
                                >
                                  <Trophy className="size-3.5" />
                                  {winner ? "Gagnant" : "Choisir gagnant"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(`Retirer « ${option.title} » et ses votes ?`)
                                    ) {
                                      deleteOption.mutate({
                                        optionId: option.id,
                                        tmdbId: option.tmdb_id,
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="size-3.5" />
                                  Retirer
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                </section>
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === "settings" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="text-xl font-bold">Personnalisation du site</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Modifie les textes, les couleurs, l’image et les valeurs par défaut.
            </p>
          </div>

          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              saveSettings.mutate();
            }}
            className="mt-6 grid gap-5 lg:grid-cols-2"
          >
            <label className={labelClassName}>
              <span>Nom du site *</span>
              <input
                value={settingsDraft.site_name}
                onChange={(event) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    site_name: event.target.value,
                  }))
                }
                required
                maxLength={100}
                className={fieldClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Slogan</span>
              <input
                value={settingsDraft.tagline}
                onChange={(event) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    tagline: event.target.value,
                  }))
                }
                maxLength={200}
                className={fieldClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Couleur principale</span>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settingsDraft.primary_color}
                  onChange={(event) =>
                    setSettingsDraft((previous) => ({
                      ...previous,
                      primary_color: event.target.value,
                    }))
                  }
                  className="h-11 w-16 rounded-lg border border-input bg-background p-1"
                />
                <input
                  value={settingsDraft.primary_color}
                  onChange={(event) =>
                    setSettingsDraft((previous) => ({
                      ...previous,
                      primary_color: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>
            </label>

            <label className={labelClassName}>
              <span>Couleur d’accent</span>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settingsDraft.accent_color}
                  onChange={(event) =>
                    setSettingsDraft((previous) => ({
                      ...previous,
                      accent_color: event.target.value,
                    }))
                  }
                  className="h-11 w-16 rounded-lg border border-input bg-background p-1"
                />
                <input
                  value={settingsDraft.accent_color}
                  onChange={(event) =>
                    setSettingsDraft((previous) => ({
                      ...previous,
                      accent_color: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>
            </label>

            <label className={`${labelClassName} lg:col-span-2`}>
              <span>URL de l’image principale</span>
              <input
                type="url"
                value={settingsDraft.hero_image_url}
                onChange={(event) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    hero_image_url: event.target.value,
                  }))
                }
                placeholder="https://..."
                className={fieldClassName}
              />
            </label>

            <label className={`${labelClassName} lg:col-span-2`}>
              <span>Texte « À propos »</span>
              <textarea
                value={settingsDraft.about_text}
                onChange={(event) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    about_text: event.target.value,
                  }))
                }
                rows={4}
                maxLength={3000}
                className={fieldClassName}
              />
            </label>

            <label className={`${labelClassName} lg:col-span-2`}>
              <span>Texte du pied de page</span>
              <input
                value={settingsDraft.footer_text}
                onChange={(event) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    footer_text: event.target.value,
                  }))
                }
                maxLength={300}
                className={fieldClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Votes par personne par défaut</span>
              <input
                type="number"
                min={1}
                max={10}
                value={settingsDraft.default_votes_per_voter}
                onChange={(event) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    default_votes_per_voter: Number(event.target.value),
                  }))
                }
                className={fieldClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Propositions par personne par défaut</span>
              <input
                type="number"
                min={0}
                max={20}
                value={settingsDraft.default_max_proposals}
                onChange={(event) =>
                  setSettingsDraft((previous) => ({
                    ...previous,
                    default_max_proposals: Number(event.target.value),
                  }))
                }
                className={fieldClassName}
              />
            </label>

            <button
              type="submit"
              disabled={saveSettings.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 lg:col-span-2"
            >
              <Save className="size-4" />
              {saveSettings.isPending ? "Enregistrement…" : "Enregistrer la personnalisation"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function AdminTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AdminStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-bold">{value}</p>
    </div>
  );
}

function AdminAccessMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Settings className="size-5" />
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link
          to="/auth"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Aller à la connexion
        </Link>
      </section>
    </main>
  );
}
