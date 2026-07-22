import { Link } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Moon, Sun, Film } from "lucide-react";

export function SiteHeader() {
  const { theme, toggle } = useTheme();
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
        </nav>
      </div>
    </header>
  );
}
