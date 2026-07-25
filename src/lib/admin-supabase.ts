import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { MoviePick } from "@/lib/movie-types";

type Screening = Tables<"screenings">;
type PollOption = Tables<"poll_options">;
type SiteSettings = Tables<"site_settings">;
type Vote = Tables<"votes">;

type ScreeningPayload = Pick<
  Screening,
  | "allow_public_proposals"
  | "cover_url"
  | "description"
  | "location"
  | "max_proposals_per_voter"
  | "poll_closes_at"
  | "poll_opens_at"
  | "scheduled_at"
  | "status"
  | "title"
  | "votes_per_voter"
>;

type SettingsPayload = Pick<
  SiteSettings,
  | "about_text"
  | "accent_color"
  | "default_max_proposals"
  | "default_votes_per_voter"
  | "footer_text"
  | "hero_image_url"
  | "primary_color"
  | "site_name"
  | "tagline"
>;

type AdminApiResponse<T> = {
  data?: T;
  error?: string;
};

async function callAdminApi<T>(action: string, data: unknown): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    throw new Error(
      "Session administrateur absente ou expirée. Déconnecte-toi puis reconnecte-toi.",
    );
  }

  const response = await fetch("/api/admin", {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, data }),
    cache: "no-store",
  });

  const responseText = await response.text();
  let payload: AdminApiResponse<T>;

  try {
    payload = JSON.parse(responseText) as AdminApiResponse<T>;
  } catch {
    throw new Error(
      response.ok
        ? "Le serveur administrateur a renvoyé une réponse invalide."
        : `Le serveur administrateur est indisponible (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || payload.error) {
    throw new Error(payload.error || `L’action administrateur a échoué (HTTP ${response.status}).`);
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "data")) {
    throw new Error("Le serveur administrateur n’a renvoyé aucune donnée.");
  }

  return payload.data as T;
}

export async function getAdminDashboard(): Promise<{
  screenings: Screening[];
  settings: SiteSettings | null;
}> {
  const [settingsResult, screeningsResult] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("screenings").select("*").order("created_at", { ascending: false }),
  ]);

  if (settingsResult.error) {
    throw settingsResult.error;
  }

  if (screeningsResult.error) {
    throw screeningsResult.error;
  }

  return {
    screenings: screeningsResult.data ?? [],
    settings: settingsResult.data,
  };
}

export async function getAdminScreeningContent({
  data,
}: {
  data: {
    screeningId: string;
  };
}): Promise<{
  options: PollOption[];
  votes: Vote[];
}> {
  const [optionsResult, votesResult] = await Promise.all([
    supabase
      .from("poll_options")
      .select("*")
      .eq("screening_id", data.screeningId)
      .order("created_at"),
    supabase.from("votes").select("*").eq("screening_id", data.screeningId),
  ]);

  if (optionsResult.error) {
    throw optionsResult.error;
  }

  if (votesResult.error) {
    throw votesResult.error;
  }

  return {
    options: optionsResult.data ?? [],
    votes: votesResult.data ?? [],
  };
}

export async function saveAdminScreening({
  data,
}: {
  data: {
    screening: ScreeningPayload;
    screeningId: string | null;
  };
}): Promise<string> {
  return callAdminApi<string>("saveScreening", data);
}

export async function deleteAdminScreening({
  data,
}: {
  data: {
    screeningId: string;
  };
}): Promise<string> {
  return callAdminApi<string>("deleteScreening", data);
}

export async function duplicateAdminScreening({
  data,
}: {
  data: {
    screeningId: string;
  };
}): Promise<string> {
  return callAdminApi<string>("duplicateScreening", data);
}

export async function updateAdminScreeningStatus({
  data,
}: {
  data: {
    screeningId: string;
    status: "open" | "closed" | "finished";
  };
}): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>("updateScreeningStatus", data);
}

export async function saveAdminSettings({
  data,
}: {
  data: {
    settings: SettingsPayload;
  };
}): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>("saveSettings", data);
}

export async function addAdminMovie({
  data,
}: {
  data: {
    movie: MoviePick;
    screeningId: string;
  };
}): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>("addMovie", data);
}

export async function deleteAdminOption({
  data,
}: {
  data: {
    optionId: string;
    screeningId: string;
  };
}): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>("deleteOption", data);
}

export async function setAdminWinner({
  data,
}: {
  data: {
    screeningId: string;
    tmdbId: number | null;
  };
}): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>("setWinner", data);
}

export async function resetAdminVotes({
  data,
}: {
  data: {
    screeningId: string;
  };
}): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>("resetVotes", data);
}
