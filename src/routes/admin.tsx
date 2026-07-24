import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Ciné-Club" },
      {
        name: "description",
        content: "Administration du ciné-club.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
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
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Accès refusé</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Tu es connecté, mais ton compte n’a pas le rôle admin.
          </p>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 inline-flex rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Se déconnecter
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Administration</h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Connexion admin validée. La page admin fonctionne.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 font-medium">
            <Settings className="h-4 w-4" />
            Diagnostic
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Ton compte est connecté et le rôle admin est bien reconnu.
          </p>

          <p className="mt-2 break-all text-xs text-muted-foreground">
            Email : {user.email ?? "email inconnu"}
          </p>
        </div>
      </section>
    </main>
  );
}
