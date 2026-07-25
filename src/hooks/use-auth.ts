import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
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

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    async function applySession(session: Session | null) {
      const currentRequestId = ++requestId;
      const user = session?.user ?? null;

      if (cancelled || currentRequestId !== requestId) {
        return;
      }

      setState({
        user,
        // Les inscriptions publiques sont désactivées. Toute session valide
        // appartient donc à un compte administrateur créé volontairement.
        isAdmin: user !== null,
        loading: false,
        error: null,
      });
    }

    async function loadInitialSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        await applySession(data.session);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("[use-auth] getSession failed:", error);

        setState({
          user: null,
          isAdmin: false,
          loading: false,
          error: getErrorMessage(error),
        });
      }
    }

    void loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
