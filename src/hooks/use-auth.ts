import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

type UseAuthResult = {
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

  return "Erreur inconnue.";
}

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

  console.error("[use-auth] has_role failed:", rpcResult.error);

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
    console.error("[use-auth] user_roles failed:", directResult.error);
    throw new Error(
      `Impossible de vérifier le rôle admin : ${directResult.error.message}`,
    );
  }

  return Boolean(directResult.data);
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: Session | null) => {
      setLoading(true);
      setError(null);

      try {
        const currentUser = session?.user ?? null;

        if (!currentUser) {
          if (cancelled) return;

          setUser(null);
          setIsAdmin(false);
          setError(null);
          return;
        }

        const currentIsAdmin = await hasAdminRole(currentUser.id);

        if (cancelled) return;

        setUser(currentUser);
        setIsAdmin(currentIsAdmin);
        setError(null);
      } catch (authError) {
        if (cancelled) return;

        console.error("[use-auth] session/admin check failed:", authError);
        setUser(null);
        setIsAdmin(false);
        setError(getErrorMessage(authError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const loadInitialSession = async () => {
      try {
        const { data, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          10_000,
          "Chargement de la session Supabase",
        );

        if (sessionError) {
          throw sessionError;
        }

        await applySession(data.session);
      } catch (authError) {
        if (cancelled) return;

        console.error("[use-auth] getSession failed:", authError);
        setUser(null);
        setIsAdmin(false);
        setError(getErrorMessage(authError));
        setLoading(false);
      }
    };

    void loadInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        window.setTimeout(() => {
          void applySession(session);
        }, 0);
      },
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isAdmin,
    loading,
    error,
  };
}
