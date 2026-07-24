import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  supabase,
  supabaseRuntimeConfig,
} from "@/integrations/supabase/client";

export const Route = createFileRoute("/debug")({
  head: () => ({
    meta: [
      { title: "Debug — Ciné-Club" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DebugPage,
});

type TestStatus = "pending" | "success" | "error";

type TestResult = {
  name: string;
  status: TestStatus;
  message: string;
};

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

  return "Erreur inconnue.";
}

function DebugPage() {
  const [hydrated, setHydrated] = useState(false);
  const [results, setResults] = useState<TestResult[]>([
    {
      name: "Hydratation JavaScript",
      status: "pending",
      message: "Le JavaScript n’a pas encore pris le relais.",
    },
    {
      name: "Supabase site_settings",
      status: "pending",
      message: "En attente…",
    },
    {
      name: "Supabase screenings",
      status: "pending",
      message: "En attente…",
    },
    {
      name: "Supabase auth.getSession",
      status: "pending",
      message: "En attente…",
    },
  ]);

  function updateResult(name: string, status: TestStatus, message: string) {
    setResults((previous) =>
      previous.map((result) =>
        result.name === name
          ? {
              ...result,
              status,
              message,
            }
          : result,
      ),
    );
  }

  useEffect(() => {
    setHydrated(true);

    updateResult(
      "Hydratation JavaScript",
      "success",
      "OK : le JavaScript fonctionne côté navigateur.",
    );

    async function runTests() {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("id, site_name")
          .eq("id", 1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        updateResult(
          "Supabase site_settings",
          "success",
          `OK : réponse reçue${data?.site_name ? ` — ${data.site_name}` : ""}.`,
        );
      } catch (error) {
        updateResult(
          "Supabase site_settings",
          "error",
          getErrorMessage(error),
        );
      }

      try {
        const { data, error } = await supabase
          .from("screenings")
          .select("id, title")
          .limit(1);

        if (error) {
          throw error;
        }

        updateResult(
          "Supabase screenings",
          "success",
          `OK : ${data?.length ?? 0} séance(s) lue(s) sur ce test.`,
        );
      } catch (error) {
        updateResult("Supabase screenings", "error", getErrorMessage(error));
      }

      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        updateResult(
          "Supabase auth.getSession",
          "success",
          data.session?.user?.email
            ? `OK : connecté avec ${data.session.user.email}.`
            : "OK : aucune session connectée, mais Supabase Auth répond.",
        );
      } catch (error) {
        updateResult(
          "Supabase auth.getSession",
          "error",
          getErrorMessage(error),
        );
      }
    }

    void runTests();
  }, []);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">
          Diagnostic Ciné-Club
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Cette page sert à vérifier si le navigateur charge bien le JavaScript
          et si Supabase répond.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-background p-4 text-sm">
          <p>
            <strong>JavaScript hydraté :</strong>{" "}
            {hydrated ? "oui" : "non"}
          </p>

          <p className="mt-2">
            <strong>Projet Supabase utilisé :</strong>{" "}
            {supabaseRuntimeConfig.projectRef}
          </p>

          <p className="mt-2">
            <strong>URL Supabase :</strong> {supabaseRuntimeConfig.url}
          </p>

          <p className="mt-2">
            <strong>Clé publishable :</strong>{" "}
            {supabaseRuntimeConfig.keyPreview}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {results.map((result) => (
            <div
              key={result.name}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{result.name}</h2>

                <span
                  className={
                    result.status === "success"
                      ? "rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600"
                      : result.status === "error"
                        ? "rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive"
                        : "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                  }
                >
                  {result.status === "success"
                    ? "OK"
                    : result.status === "error"
                      ? "Erreur"
                      : "Test…"}
                </span>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {result.message}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
