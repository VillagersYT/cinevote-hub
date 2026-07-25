import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, error } = useAuth();

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error("[admin] sign out failed:", signOutError);
    } finally {
      navigate({ to: "/auth", replace: true });
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Chargement de ta session…
          </p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border border-destructive/30 bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Erreur d’authentification</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            La page admin s’affiche maintenant, mais la vérification Supabase a
            échoué.
          </p>

          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>

          <Link
            to="/auth"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Retour à la connexion
          </Link>
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

          <Link
            to="/auth"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Aller à la connexion
          </Link>
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
              Session Supabase validée. Ce compte est administrateur.
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
            Ton compte est connecté et possède automatiquement l’accès admin.
          </p>

          <p className="mt-2 break-all text-xs text-muted-foreground">
            Email : {user.email ?? "email inconnu"}
          </p>
        </div>
      </section>
    </main>
  );
}
