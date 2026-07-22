import { Link } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Moon, Sun, Film, Shield } from "lucide-react";

export function SiteHeader() {
  const { theme, toggle } = useTheme();
  const { user, isAdmin } = useAuth();
  const { data: settings } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <Film className="h-5 w-5 text-primary" />
          <span>{settings?.site_name ?? "Ciné-Club"}</span>
        </Link>
        <nav className="flex items-center gap-1">
          <button
            onClick={toggle}
            aria-label="Basculer thème"
            className="rounded-md p-2 hover:bg-secondary transition"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user && isAdmin ? (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition"
            >
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
