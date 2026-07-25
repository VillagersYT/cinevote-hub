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

async function hasAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (!error && data === true) {
    return true;
  }

  if (error) {
    console.warn("[use-auth] has_role failed, fallback user_roles:", error);
  } else {
    console.warn("[use-auth] has_role returned false, fallback user_roles.");
  }

  const fallback = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (fallback.error) {
    throw fallback.error;
  }

  return fallback.data?.role === "admin";
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

      setState((previous) => ({
        ...previous,
        loading: true,
        error: null,
      }));

      try {
        const user = session?.user ?? null;
        const isAdmin = user ? await hasAdminRole(user.id) : false;

        if (cancelled || currentRequestId !== requestId) {
          return;
        }

        setState({
          user,
          isAdmin,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled || currentRequestId !== requestId) {
          return;
        }

        console.error("[use-auth] admin/session check failed:", error);

        setState({
          user: null,
          isAdmin: false,
          loading: false,
          error: getErrorMessage(error),
        });
      }
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
