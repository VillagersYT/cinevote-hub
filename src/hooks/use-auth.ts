import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { hasAdminRole } from "@/lib/admin-auth";
import { getErrorMessage, withTimeout } from "@/lib/supabase-safe";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    async function applySession(session: Session | null) {
      const currentRequestId = ++requestId;

      setLoading(true);
      setError(null);

      try {
        const currentUser = session?.user ?? null;
        const currentIsAdmin = currentUser
          ? await hasAdminRole(currentUser.id)
          : false;

        if (cancelled || currentRequestId !== requestId) {
          return;
        }

        setUser(currentUser);
        setIsAdmin(currentIsAdmin);
        setError(null);
      } catch (authError) {
        if (cancelled || currentRequestId !== requestId) {
          return;
        }

        console.error("[use-auth] session/admin check failed:", authError);

        setUser(null);
        setIsAdmin(false);
        setError(getErrorMessage(authError));
      } finally {
        if (!cancelled && currentRequestId === requestId) {
          setLoading(false);
        }
      }
    }

    async function loadInitialSession() {
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
        if (cancelled) {
          return;
        }

        console.error("[use-auth] initial session failed:", authError);

        setUser(null);
        setIsAdmin(false);
        setError(getErrorMessage(authError));
        setLoading(false);
      }
    }

    void loadInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isAdmin,
    loading,
    error,
  };
}
