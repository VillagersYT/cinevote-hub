import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { saveScreening, deleteScreening, deleteOption, saveSettings } from "@/lib/screenings.functions";
import { toast } from "sonner";
import { Trash2, Plus, Settings, Film, LogOut, Trophy } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Ciné-Club" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: AdminPage,
});

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"screenings" | "settings">("screenings");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) return <div className="p-10 text-muted-foreground">Chargement…</div>;
  if (!user) return null;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="font-display text-2xl font-bold">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre compte n'a pas le rôle admin. Un administrateur doit vous l'attribuer via la base.
        </p>
        <button
          onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth" }))}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm"
        >
          Se déconnecter
        </button>
      </div>
    );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Administration</h1>
        <button
          onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <LogOut className="h-3.5 w-3.5" /> Déconnexion
        </button>
      </div>
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        <button
          onClick={() => setTab("screenings")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${tab === "screenings" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
        >
          <Film className="h-3.5 w-3.5" /> Séances
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${tab === "settings" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
        >
          <Settings className="h-3.5 w-3.5" /> Paramètres
        </button>
      </div>
      {tab === "screenings" ? <ScreeningsAdmin /> : <SettingsAdmin />}
    </main>
  );
}

function emptyScreening() {
  return {
    id: undefined as string | undefined,
    title: "",
    description: "",
    location: "",
    scheduled_at: "",
    poll_opens_at: "",
    poll_closes_at: "",
    allow_public_proposals: true,
    max_proposals_per_voter: 3,
    votes_per_voter: 1,
    status: "open" as "open" | "closed" | "finished",
    cover_url: "",
    winner_movie_id: null as number | null,
  };
}

function ScreeningsAdmin() {
  const qc = useQueryClient();
  const save = useServerFn(saveScreening);
  const del = useServerFn(deleteScreening);
  const delOpt = useServerFn(deleteOption);
  const [editing, setEditing] = useState<ReturnType<typeof emptyScreening> | null>(null);

  const { data: screenings } = useQuery({
    queryKey: ["admin_screenings"],
    queryFn: async () => {
      const { data } = await supabase.from("screenings").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (s: ReturnType<typeof emptyScreening>) => {
      await save({
        data: {
          ...s,
          description: s.description || null,
          location: s.location || null,
          scheduled_at: s.scheduled_at ? new Date(s.scheduled_at).toISOString() : null,
          poll_opens_at: s.poll_opens_at ? new Date(s.poll_opens_at).toISOString() : null,
          poll_closes_at: s.poll_closes_at ? new Date(s.poll_closes_at).toISOString() : null,
          cover_url: s.cover_url || null,
        } as any,
      });
    },
    onSuccess: () => {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["admin_screenings"] });
      qc.invalidateQueries({ queryKey: ["screenings"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin_screenings"] });
      qc.invalidateQueries({ queryKey: ["screenings"] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <button
          onClick={() => setEditing(emptyScreening())}
          className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nouvelle séance
        </button>
        <div className="space-y-2">
          {screenings?.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between rounded-lg border p-3 ${editing?.id === s.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <button
                onClick={() => setEditing({ ...(emptyScreening()), ...s, cover_url: s.cover_url ?? "", description: s.description ?? "", location: s.location ?? "", scheduled_at: s.scheduled_at ? new Date(s.scheduled_at).toISOString().slice(0, 16) : "", poll_opens_at: s.poll_opens_at ? new Date(s.poll_opens_at).toISOString().slice(0, 16) : "", poll_closes_at: s.poll_closes_at ? new Date(s.poll_closes_at).toISOString().slice(0, 16) : "" } as any)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground">{s.status}</div>
              </button>
              <div className="flex gap-1">
                <Link
                  to="/screenings/$id"
                  params={{ id: s.id }}
                  className="rounded p-1.5 text-xs hover:bg-secondary"
                >
                  Voir
                </Link>
                <button
                  onClick={() => {
                    if (confirm("Supprimer cette séance ?")) delMut.mutate(s.id);
                  }}
                  className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-lg font-bold">
            {editing.id ? "Modifier la séance" : "Nouvelle séance"}
          </h2>
          <div className="space-y-3">
            <Field label="Titre">
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className={inputCls} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lieu">
                <input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Image de couverture (URL)">
                <input value={editing.cover_url} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Date de projection">
              <input type="datetime-local" value={editing.scheduled_at} onChange={(e) => setEditing({ ...editing, scheduled_at: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ouverture du sondage">
                <input type="datetime-local" value={editing.poll_opens_at} onChange={(e) => setEditing({ ...editing, poll_opens_at: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Fermeture du sondage">
                <input type="datetime-local" value={editing.poll_closes_at} onChange={(e) => setEditing({ ...editing, poll_closes_at: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Votes / personne">
                <input type="number" min={1} max={50} value={editing.votes_per_voter} onChange={(e) => setEditing({ ...editing, votes_per_voter: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Propositions / personne">
                <input type="number" min={1} max={50} value={editing.max_proposals_per_voter} onChange={(e) => setEditing({ ...editing, max_proposals_per_voter: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Statut">
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })} className={inputCls}>
                  <option value="open">Ouvert</option>
                  <option value="closed">Fermé</option>
                  <option value="finished">Terminé</option>
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.allow_public_proposals} onChange={(e) => setEditing({ ...editing, allow_public_proposals: e.target.checked })} />
              Autoriser les propositions publiques
            </label>
          </div>

          {editing.id && <ExistingOptions screeningId={editing.id} onDelete={(id) => delOpt({ data: { id } }).then(() => qc.invalidateQueries())} onWinner={(tmdbId) => setEditing({ ...editing, winner_movie_id: tmdbId })} winnerId={editing.winner_movie_id} />}

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => saveMut.mutate(editing)}
              disabled={saveMut.isPending || !editing.title}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button onClick={() => setEditing(null)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExistingOptions({ screeningId, onDelete, onWinner, winnerId }: { screeningId: string; onDelete: (id: string) => void; onWinner: (tmdbId: number) => void; winnerId: number | null }) {
  const { data: options } = useQuery({
    queryKey: ["admin_options", screeningId],
    queryFn: async () => {
      const { data } = await supabase.from("poll_options").select("*").eq("screening_id", screeningId);
      return data ?? [];
    },
  });
  if (!options?.length) return null;
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-2 text-sm font-medium">Films proposés ({options.length})</div>
      <div className="space-y-1.5">
        {options.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded border border-border p-2 text-xs">
            <div className="min-w-0 flex-1 truncate">
              {o.title} <span className="text-muted-foreground">({o.release_year})</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onWinner(o.tmdb_id)}
                className={`rounded p-1 ${winnerId === o.tmdb_id ? "bg-accent text-accent-foreground" : "hover:bg-secondary"}`}
                title="Marquer gagnant"
              >
                <Trophy className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(o.id)} className="rounded p-1 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsAdmin() {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveSettings);
  const { data } = useQuery({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("id", 1).single();
      return data;
    },
  });
  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (data && !form) setForm({ ...data, hero_image_url: data.hero_image_url ?? "" });
  }, [data, form]);

  const mut = useMutation({
    mutationFn: async () =>
      saveFn({
        data: {
          site_name: form.site_name,
          tagline: form.tagline || null,
          primary_color: form.primary_color || null,
          accent_color: form.accent_color || null,
          hero_image_url: form.hero_image_url || null,
          about_text: form.about_text || null,
          footer_text: form.footer_text || null,
          default_votes_per_voter: Number(form.default_votes_per_voter),
          default_max_proposals: Number(form.default_max_proposals),
        } as any,
      }),
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["site_settings"] });
      qc.invalidateQueries({ queryKey: ["admin_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!form) return <div className="text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 font-display text-lg font-bold">Personnalisation du site</h2>
      <div className="space-y-3">
        <Field label="Nom du site">
          <input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Accroche">
          <input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Image de hero (URL)">
          <input value={form.hero_image_url ?? ""} onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })} className={inputCls} />
        </Field>
        <Field label="À propos">
          <textarea rows={4} value={form.about_text ?? ""} onChange={(e) => setForm({ ...form, about_text: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Pied de page">
          <input value={form.footer_text ?? ""} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} className={inputCls} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Votes / personne (défaut)">
            <input type="number" min={1} max={50} value={form.default_votes_per_voter} onChange={(e) => setForm({ ...form, default_votes_per_voter: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Propositions max (défaut)">
            <input type="number" min={1} max={50} value={form.default_max_proposals} onChange={(e) => setForm({ ...form, default_max_proposals: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </div>
      <button
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Enregistrer
      </button>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
