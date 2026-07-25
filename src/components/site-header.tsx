import { Link } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Film, LogIn, Moon, Shield, Sun } from "lucide-react";
import { useEffect } from "react";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function validColor(value: string | null | undefined, fallback: string) {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

export function SiteHeader() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const { data: settings } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  useEffect(() => {
    const root = document.documentElement;
    const primary = validColor(settings?.primary_color, "#f97316");
    const accent = validColor(settings?.accent_color, "#fbbf24");

    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--accent", accent);
    root.style.setProperty(
      "--gradient-hero",
      `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
    );
    root.style.setProperty("--shadow-glow", `0 20px 60px -20px ${primary}80`);

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--gradient-hero");
      root.style.removeProperty("--shadow-glow");
    };
  }, [settings?.accent_color, settings?.primary_color]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <Film className="h-5 w-5 text-primary" />
          <span>{settings?.site_name ?? "Ciné-Club"}</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to={user ? "/admin" : "/auth"}
            aria-label={user ? "Ouvrir le panel admin" : "Connexion admin"}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-secondary"
          >
            {user ? (
              <Shield className="h-4 w-4" aria-hidden="true" />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{user ? "Administration" : "Connexion"}</span>
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}
            className="rounded-md p-2 transition hover:bg-secondary"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
