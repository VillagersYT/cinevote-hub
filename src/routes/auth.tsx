import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion admin — Ciné-Club" },
      {
        name: "description",
        content: "Espace d'administration du ciné-club.",
      },
      { property: "og:title", content: "Connexion admin — Ciné-Club" },
      {
        property: "og:description",
        content: "Connexion à l'espace d'administration du ciné-club.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const user = data.user;

      if (!user) {
        throw new Error("Connexion impossible.");
      }

      if (!user.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Compte non vérifié.");
      }

      const { data: isAdmin, error: roleError } = await supabase.rpc(
        "has_role",
        {
          _user_id: user.id,
          _role: "admin",
        },
      );

      if (roleError || !isAdmin) {
        console.error("[auth] admin role check failed:", roleError);
        await supabase.auth.signOut();
        throw new Error("Accès refusé.");
      }

      toast.success("Connecté");
      navigate({ to: "/admin" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Accès refusé.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Espace admin</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Réservé aux administrateurs du ciné-club.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}
