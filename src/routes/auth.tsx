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

  return "Erreur de connexion.";
}

async function withTimeout<T>(
  operation: PromiseLike<T>,
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

  try {
    return await Promise.race([Promise.resolve(operation), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function hasAdminRole(userId: string): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      }),
      10_000,
      "Vérification du rôle admin",
    );

    if (!error && data === true) {
      return true;
    }

    if (error) {
      console.error("[auth] has_role failed:", error);
    } else {
      console.warn(
        "[auth] has_role returned false, fallback sur user_roles.",
      );
    }
  } catch (error) {
    console.error("[auth] has_role crashed:", error);
  }

  const { data, error } = await withTimeout(
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    10_000,
    "Lecture de la table user_roles",
  );

  if (error) {
    console.error("[auth] user_roles failed:", error);

    throw new Error(
      `Impossible de vérifier le rôle admin : ${error.message}`,
    );
  }

  return data?.role === "admin";
}

function AuthPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanEmail = email.trim();

    setErrorMessage("");
    setLoading(true);

    try {
      if (!cleanEmail) {
        throw new Error("Entre ton email.");
      }

      if (!password) {
        throw new Error("Entre ton mot de passe.");
      }

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        }),
        10_000,
        "Connexion Supabase",
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error("Connexion impossible : aucun utilisateur retourné.");
      }

      const isAdmin = await hasAdminRole(data.user.id);

      if (!isAdmin) {
        try {
          await withTimeout(
            supabase.auth.signOut(),
            10_000,
            "Déconnexion Supabase",
          );
        } catch (signOutError) {
          console.error(
            "[auth] signOut after denied access failed:",
            signOutError,
          );
        }

        throw new Error(
          "Accès refusé : ce compte n’a pas le rôle admin dans Supabase.",
        );
      }

      toast.success("Connecté");
      await navigate({ to: "/admin", replace: true });
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto max-w-md px-4 py-16">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Espace admin</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Connecte-toi avec un compte qui possède le rôle admin.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="email" className="block space-y-2">
            <span className="text-sm font-medium">Email</span>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@exemple.fr"
              autoComplete="email"
              required
              disabled={loading}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label htmlFor="password" className="block space-y-2">
            <span className="text-sm font-medium">Mot de passe</span>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              required
              disabled={loading}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
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
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
      }
