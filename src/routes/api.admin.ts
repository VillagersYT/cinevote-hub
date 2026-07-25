import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { ZodError } from "zod";

function getErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return "Les données envoyées au serveur sont invalides.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "Erreur serveur inconnue.";
}

function getErrorStatus(error: unknown): number {
  const message = getErrorMessage(error).toLocaleLowerCase("fr-FR");

  if (message.includes("session administrateur")) {
    return 401;
  }

  if (error instanceof ZodError) {
    return 400;
  }

  return 500;
}

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { handleAdminAction } = await import("@/lib/admin-api.server");
          const data = await handleAdminAction({
            authorization: request.headers.get("authorization"),
            body,
          });

          return Response.json(
            { data },
            {
              headers: {
                "cache-control": "no-store",
              },
            },
          );
        } catch (error) {
          const message = getErrorMessage(error);

          console.error("[api/admin]", message);

          return Response.json(
            { error: message },
            {
              status: getErrorStatus(error),
              headers: {
                "cache-control": "no-store",
              },
            },
          );
        }
      },
    },
  },
});
