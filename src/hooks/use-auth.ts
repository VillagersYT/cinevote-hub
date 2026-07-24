import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

async function hasAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    console.error("[use-auth] has_role error:", error);
    return false;
  }

  return data === true;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      const currentIsAdmin = currentUser
        ? await hasAdminRole(currentUser.id)
        : false;

      if (cancelled) return;

      setUser(currentUser);
      setIsAdmin(currentIsAdmin);
      setLoading(false);
    }

    void loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);
        setLoading(true);

        window.setTimeout(() => {
          void (async () => {
            const currentIsAdmin = currentUser
              ? await hasAdminRole(currentUser.id)
              : false;

            if (cancelled) return;

            setIsAdmin(currentIsAdmin);
            setLoading(false);
          })();
        }, 0);
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isAdmin,
    loading,
  };
}
