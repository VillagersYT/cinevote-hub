import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur d'authentification inconnue.";
}

async function hasAdminRole(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (error) {
      console.error("[use-auth] has_role error:", error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error("[use-auth] has_role crashed:", error);
    return false;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function loadSession() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const currentUser = data.session?.user ?? null;
        const currentIsAdmin = currentUser
          ? await hasAdminRole(currentUser.id)
          : false;

        if (cancelled) return;

        setUser(currentUser);
        setIsAdmin(currentIsAdmin);
        setError(null);
      } catch (authError) {
        if (cancelled) return;

        console.error("[use-auth] session load failed:", authError);
        setUser(null);
        setIsAdmin(false);
        setError(getErrorMessage(authError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);
        setIsAdmin(false);
        setError(null);
        setLoading(true);

        window.setTimeout(() => {
          void (async () => {
            try {
              const currentIsAdmin = currentUser
                ? await hasAdminRole(currentUser.id)
                : false;

              if (cancelled) return;

              setIsAdmin(currentIsAdmin);
              setError(null);
            } catch (authError) {
              if (cancelled) return;

              console.error("[use-auth] auth state check failed:", authError);
              setIsAdmin(false);
              setError(getErrorMessage(authError));
            } finally {
              if (!cancelled) {
                setLoading(false);
              }
            }
          })();
        }, 0);
      });

      unsubscribe = () => {
        data.subscription.unsubscribe();
      };
    } catch (authError) {
      console.error("[use-auth] auth listener failed:", authError);
      setUser(null);
      setIsAdmin(false);
      setError(getErrorMessage(authError));
      setLoading(false);
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return {
    user,
    isAdmin,
    loading,
    error,
  };
}
