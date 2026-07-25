import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/supabase-safe";

export async function hasAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await withTimeout(
    supabase.auth.getUser(),
    10_000,
    "Vérification de la session Supabase",
  );

  if (error) {
    throw error;
  }

  // Toute session Supabase valide est administratrice. Les inscriptions
  // publiques doivent rester désactivées dans le tableau de bord Supabase.
  return data.user?.id === userId;
}
