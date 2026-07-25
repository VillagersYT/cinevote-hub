import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const QUICK_ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL?.trim() ?? "";

type LoginMode = "account" | "quick";

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

function AuthPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [quickPassword, setQuickPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMode, setLoadingMode] = useState<LoginMode | null>(null);

  const loading = loadingMode !== null;

  const login = async (
    loginEmail: string,
    loginPassword: string,
    mode: LoginMode,
  ) => {
    setErrorMessage("");
    setLoadingMode(mode);

    try {
      if (!loginEmail) {
        throw new Error("Entre ton email.");
      }

      if (!loginPassword) {
        throw new Error("Entre ton mot de passe.");
      }

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        }),
        10_000,
        "Connexion Supabase",
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user || !data.session) {
        throw new Error("Connexion impossible : aucune session retournée.");
      }

      // Les inscriptions publiques sont désactivées : toute session Supabase
      // valide correspond donc à un compte administrateur autorisé.
      toast.success("Connecté");
      await navigate({ to: "/admin", replace: true });
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingMode(null);
    }
  };

  const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login(email.trim(), password, "account");
  };

  const submitQuickPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!QUICK_ADMIN_EMAIL) {
      const message =
        "Connexion rapide non configurée : ajoute VITE_ADMIN_EMAIL dans Vercel.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    await login(QUICK_ADMIN_EMAIL, quickPassword, "quick");
  };

  return (
    <main className="container mx-auto max-w-md px-4 py-16">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Espace admin</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Tout compte Supabase existant est considéré comme administrateur.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <form onSubmit={submitAccount} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMode === "account" ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            ou
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submitQuickPassword} className="space-y-4">
          <div>
            <h2 className="font-semibold">Connexion rapide</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre uniquement le mot de passe du compte administrateur
              configuré.
            </p>
          </div>

          <label htmlFor="quick-password" className="block space-y-2">
            <span className="text-sm font-medium">
              Mot de passe administrateur
            </span>

            <input
              id="quick-password"
              type="password"
              value={quickPassword}
              onChange={(event) => setQuickPassword(event.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              required
              disabled={loading}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <button
            type="submit"
            disabled={loading || !QUICK_ADMIN_EMAIL}
            className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMode === "quick"
              ? "Connexion…"
              : "Entrer avec le mot de passe"}
          </button>

          {!QUICK_ADMIN_EMAIL && (
            <p className="text-xs text-muted-foreground">
              Ajoute la variable Vercel{" "}
              <code className="rounded bg-secondary px-1 py-0.5">
                VITE_ADMIN_EMAIL
              </code>{" "}
              pour activer cette option.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
