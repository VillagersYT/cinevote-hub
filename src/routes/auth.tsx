import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion admin — Ciné-Club" },
      { name: "description", content: "Espace d'administration du ciné-club." },
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Compte non vérifié.");
      }
      const { data: adminRole, error: roleError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleError || !adminRole) {
        await supabase.auth.signOut();
        throw new Error("Accès refusé.");
      }
      toast.success("Connecté");
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err?.message || "Accès refusé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-card">
        <h1 className="font-display text-2xl font-bold">Espace admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Réservé aux administrateurs du ciné-club.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "…" : "Se connecter"}
          </button>
        </form>
      </div>
    </main>
  );
}
