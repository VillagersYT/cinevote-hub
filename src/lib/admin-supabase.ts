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

type PostgrestFailure = {
  message: string;
};

function requireData<T>(data: T | null, error: PostgrestFailure | null, message: string): T {
  if (error) {
    throw error;
  }

  if (data === null) {
    throw new Error(message);
  }

  return data;
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
  if (data.screeningId) {
    const result = await supabase
      .from("screenings")
      .update(data.screening)
      .eq("id", data.screeningId)
      .select("id")
      .maybeSingle();

    return requireData(result.data, result.error, "Cette séance n’existe plus.").id;
  }

  const result = await supabase.from("screenings").insert(data.screening).select("id").single();

  return requireData(result.data, result.error, "La séance n’a pas été créée.").id;
}

export async function deleteAdminScreening({
  data,
}: {
  data: {
    screeningId: string;
  };
}): Promise<string> {
  const result = await supabase
    .from("screenings")
    .delete()
    .eq("id", data.screeningId)
    .select("id")
    .maybeSingle();

  return requireData(result.data, result.error, "Cette séance n’existe plus.").id;
}

export async function duplicateAdminScreening({
  data,
}: {
  data: {
    screeningId: string;
  };
}): Promise<string> {
  const sourceResult = await supabase
    .from("screenings")
    .select("*")
    .eq("id", data.screeningId)
    .maybeSingle();
  const source = requireData(sourceResult.data, sourceResult.error, "Cette séance n’existe plus.");

  const createdResult = await supabase
    .from("screenings")
    .insert({
      allow_public_proposals: source.allow_public_proposals,
      cover_url: source.cover_url,
      description: source.description,
      location: source.location,
      max_proposals_per_voter: source.max_proposals_per_voter,
      poll_closes_at: null,
      poll_opens_at: null,
      scheduled_at: null,
      status: "closed",
      title: `${source.title} — copie`,
      votes_per_voter: source.votes_per_voter,
      winner_movie_id: null,
    })
    .select("id")
    .single();

  return requireData(createdResult.data, createdResult.error, "La copie n’a pas été créée.").id;
}

export async function updateAdminScreeningStatus({
  data,
}: {
  data: {
    screeningId: string;
    status: "open" | "closed" | "finished";
  };
}): Promise<{ success: true }> {
  const result = await supabase
    .from("screenings")
    .update({ status: data.status })
    .eq("id", data.screeningId)
    .select("id")
    .maybeSingle();

  requireData(result.data, result.error, "Cette séance n’existe plus.");

  return { success: true };
}

export async function saveAdminSettings({
  data,
}: {
  data: {
    settings: SettingsPayload;
  };
}): Promise<{ success: true }> {
  const result = await supabase
    .from("site_settings")
    .upsert({
      ...data.settings,
      id: 1,
    })
    .select("id")
    .single();

  requireData(result.data, result.error, "Les réglages n’ont pas été enregistrés.");

  return { success: true };
}

export async function addAdminMovie({
  data,
}: {
  data: {
    movie: MoviePick;
    screeningId: string;
  };
}): Promise<{ success: true }> {
  const result = await supabase
    .from("poll_options")
    .insert({
      backdrop_path: data.movie.backdrop_path,
      original_title: data.movie.original_title,
      overview: data.movie.overview,
      poster_path: data.movie.poster_path,
      proposer_name: "Administration",
      proposer_voter_id: null,
      release_year: data.movie.release_year,
      runtime: data.movie.runtime,
      screening_id: data.screeningId,
      title: data.movie.title,
      tmdb_id: data.movie.id,
    })
    .select("id")
    .single();

  if (result.error?.code === "23505") {
    throw new Error("Ce film est déjà présent dans cette séance.");
  }

  requireData(result.data, result.error, "Le film n’a pas été ajouté.");

  return { success: true };
}

export async function deleteAdminOption({
  data,
}: {
  data: {
    optionId: string;
    screeningId: string;
  };
}): Promise<{ success: true }> {
  const optionResult = await supabase
    .from("poll_options")
    .select("id, tmdb_id")
    .eq("id", data.optionId)
    .eq("screening_id", data.screeningId)
    .maybeSingle();
  const option = requireData(optionResult.data, optionResult.error, "Ce film n’existe plus dans cette séance.");

  const deleteResult = await supabase
    .from("poll_options")
    .delete()
    .eq("id", option.id)
    .select("id")
    .maybeSingle();

  requireData(deleteResult.data, deleteResult.error, "Ce film n’existe plus dans cette séance.");

  const screeningResult = await supabase
    .from("screenings")
    .select("winner_movie_id")
    .eq("id", data.screeningId)
    .maybeSingle();

  if (screeningResult.error) {
    throw screeningResult.error;
  }

  if (screeningResult.data?.winner_movie_id === option.tmdb_id) {
    const clearWinnerResult = await supabase
      .from("screenings")
      .update({ winner_movie_id: null })
      .eq("id", data.screeningId)
      .select("id")
      .maybeSingle();

    requireData(clearWinnerResult.data, clearWinnerResult.error, "Cette séance n’existe plus.");
  }

  return { success: true };
}

export async function setAdminWinner({
  data,
}: {
  data: {
    screeningId: string;
    tmdbId: number | null;
  };
}): Promise<{ success: true }> {
  if (data.tmdbId !== null) {
    const optionResult = await supabase
      .from("poll_options")
      .select("id")
      .eq("screening_id", data.screeningId)
      .eq("tmdb_id", data.tmdbId)
      .maybeSingle();

    requireData(optionResult.data, optionResult.error, "Ce film ne fait pas partie de cette séance.");
  }

  const result = await supabase
    .from("screenings")
    .update({ winner_movie_id: data.tmdbId })
    .eq("id", data.screeningId)
    .select("id")
    .maybeSingle();

  requireData(result.data, result.error, "Cette séance n’existe plus.");

  return { success: true };
}

export async function resetAdminVotes({
  data,
}: {
  data: {
    screeningId: string;
  };
}): Promise<{ success: true }> {
  const result = await supabase
    .from("votes")
    .delete()
    .eq("screening_id", data.screeningId)
    .select("id");

  if (result.error) {
    throw result.error;
  }

  return { success: true };
}
