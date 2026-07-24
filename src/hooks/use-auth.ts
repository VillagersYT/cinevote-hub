import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

async function hasAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    console.error("[use-auth] admin role check failed:", error);
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

    const loadSession = async () => {
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
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
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
      authListener.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isAdmin,
    loading,
  };
}
