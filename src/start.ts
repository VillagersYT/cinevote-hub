import { createStart, createMiddleware } from "@tanstack/react-start";

import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ handlerType, next }) => {
  try {
    return await next();
  } catch (error) {
    // Les fonctions serveur attendent une erreur sérialisée par TanStack Start.
    // Retourner une page HTML ici fait afficher tout son code dans les toasts.
    if (handlerType === "serverFn") {
      throw error;
    }

    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error(error);

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
