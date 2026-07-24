import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion admin — Ciné-Club" },
      {
        name: "description",
        content: "Connexion à l'espace d'administration du ciné-club.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `${label} a expiré après ${Math.round(timeoutMs / 1000)} secondes.`,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function hasAdminRole(userId: string): Promise<boolean> {
  const rpcResult = await withTimeout(
    (supabase as any).rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    }),
    10_000,
    "Vérification du rôle admin",
  );

  if (!rpcResult.error) {
    return rpcResult.data === true;
  }

  console.error("[auth] has_role failed:", rpcResult.error);

  const directResult = await withTimeout(
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    10_000,
    "Lecture de la table user_roles",
  );

  if (directResult.error) {
    console.error("[auth] user_roles failed:", directResult.error);
    throw new Error(
      `Impossible de vérifier le rôle admin : ${directResult.error.message}`,
    );
  }

  return Boolean(directResult.data);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Erreur de connexion.";
}

function AuthPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");
    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        10_000,
        "Connexion Supabase",
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error("Connexion impossible.");
      }

      const isAdmin = await hasAdminRole(data.user.id);

      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error(
          "Accès refusé : ce compte n’a pas le rôle admin dans Supabase.",
        );
      }

      toast.success("Connecté");
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] max-w-md flex-col justify-center px-4 py-12">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Espace admin</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Connecte-toi avec un compte qui possède le rôle admin.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Email
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@exemple.fr"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Mot de passe
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

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
