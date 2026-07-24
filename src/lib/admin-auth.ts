import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/supabase-safe";

export async function hasAdminRole(userId: string): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      }),
      10_000,
      "Vérification du rôle admin",
    );

    if (!error) {
      return data === true;
    }

    console.warn("[admin-auth] has_role error, fallback sur user_roles:", error);
  } catch (error) {
    console.warn("[admin-auth] has_role timeout/crash, fallback sur user_roles:", error);
  }

  const { data, error } = await withTimeout(
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    10_000,
    "Lecture directe de user_roles",
  );

  if (error) {
    throw error;
  }

  return data?.role === "admin";
}
