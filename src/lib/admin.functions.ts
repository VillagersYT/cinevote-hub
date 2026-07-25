import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuidSchema = z.string().uuid();
const nullableShortText = z.string().trim().max(500).nullable();
const nullableLongText = z.string().trim().max(5_000).nullable();
const nullableDateTime = z.string().datetime().nullable();
const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

const screeningPayloadSchema = z.object({
  allow_public_proposals: z.boolean(),
  cover_url: z.string().trim().max(2_000).nullable(),
  description: nullableLongText,
  location: nullableShortText,
  max_proposals_per_voter: z.number().int().min(0).max(20),
  poll_closes_at: nullableDateTime,
  poll_opens_at: nullableDateTime,
  scheduled_at: nullableDateTime,
  status: z.enum(["open", "closed", "finished"]),
  title: z.string().trim().min(1).max(160),
  votes_per_voter: z.number().int().min(1).max(10),
});

const settingsPayloadSchema = z.object({
  about_text: nullableLongText,
  accent_color: colorSchema,
  default_max_proposals: z.number().int().min(0).max(20),
  default_votes_per_voter: z.number().int().min(1).max(10),
  footer_text: nullableShortText,
  hero_image_url: z.string().trim().max(2_000).nullable(),
  primary_color: colorSchema,
  site_name: z.string().trim().min(1).max(100),
  tagline: nullableShortText,
});

const moviePayloadSchema = z.object({
  backdrop_path: z.string().nullable(),
  id: z.number().int().positive(),
  original_title: z.string().max(300),
  overview: z.string().max(5_000),
  poster_path: z.string().nullable(),
  release_year: z.number().int().min(1800).max(3000).nullable(),
  runtime: z.number().int().min(0).max(2_000).nullable(),
  title: z.string().trim().min(1).max(300),
});

async function requireAdminClient() {
  const [{ getRequest }, { supabaseAdmin }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("@/integrations/supabase/client.server"),
  ]);
  const authorization = getRequest().headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Session administrateur absente. Déconnecte-toi puis reconnecte-toi.");
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  if (!accessToken) {
    throw new Error("Session administrateur invalide. Déconnecte-toi puis reconnecte-toi.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("Session administrateur expirée. Déconnecte-toi puis reconnecte-toi.");
  }

  return supabaseAdmin;
}

export const getAdminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await requireAdminClient();
  const [settingsResult, screeningsResult] = await Promise.all([
    supabaseAdmin.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabaseAdmin.from("screenings").select("*").order("created_at", { ascending: false }),
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
});

export const getAdminScreeningContent = createServerFn({ method: "GET" })
  .validator(
    z.object({
      screeningId: uuidSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const [optionsResult, votesResult] = await Promise.all([
      supabaseAdmin
        .from("poll_options")
        .select("*")
        .eq("screening_id", data.screeningId)
        .order("created_at"),
      supabaseAdmin.from("votes").select("*").eq("screening_id", data.screeningId),
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
  });

export const saveAdminScreening = createServerFn({ method: "POST" })
  .validator(
    z.object({
      screening: screeningPayloadSchema,
      screeningId: uuidSchema.nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const { poll_closes_at: pollClosesAt, poll_opens_at: pollOpensAt } = data.screening;

    if (
      pollOpensAt &&
      pollClosesAt &&
      new Date(pollOpensAt).getTime() >= new Date(pollClosesAt).getTime()
    ) {
      throw new Error("La fermeture du sondage doit être après son ouverture.");
    }

    if (data.screeningId) {
      const { data: updated, error } = await supabaseAdmin
        .from("screenings")
        .update(data.screening)
        .eq("id", data.screeningId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!updated) {
        throw new Error("Cette séance n’existe plus.");
      }

      return updated.id;
    }

    const { data: created, error } = await supabaseAdmin
      .from("screenings")
      .insert(data.screening)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return created.id;
  });

export const deleteAdminScreening = createServerFn({ method: "POST" })
  .validator(
    z.object({
      screeningId: uuidSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const { error } = await supabaseAdmin.from("screenings").delete().eq("id", data.screeningId);

    if (error) {
      throw error;
    }

    return data.screeningId;
  });

export const duplicateAdminScreening = createServerFn({ method: "POST" })
  .validator(
    z.object({
      screeningId: uuidSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const { data: source, error: sourceError } = await supabaseAdmin
      .from("screenings")
      .select("*")
      .eq("id", data.screeningId)
      .maybeSingle();

    if (sourceError) {
      throw sourceError;
    }

    if (!source) {
      throw new Error("Cette séance n’existe plus.");
    }

    const { data: created, error } = await supabaseAdmin
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

    if (error) {
      throw error;
    }

    return created.id;
  });

export const updateAdminScreeningStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      screeningId: uuidSchema,
      status: z.enum(["open", "closed", "finished"]),
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const { error } = await supabaseAdmin
      .from("screenings")
      .update({ status: data.status })
      .eq("id", data.screeningId);

    if (error) {
      throw error;
    }

    return { success: true };
  });

export const saveAdminSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      settings: settingsPayloadSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      ...data.settings,
      id: 1,
    });

    if (error) {
      throw error;
    }

    return { success: true };
  });

export const addAdminMovie = createServerFn({ method: "POST" })
  .validator(
    z.object({
      movie: moviePayloadSchema,
      screeningId: uuidSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const { error } = await supabaseAdmin.from("poll_options").insert({
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
    });

    if (error?.code === "23505") {
      throw new Error("Ce film est déjà présent dans cette séance.");
    }

    if (error) {
      throw error;
    }

    return { success: true };
  });

export const deleteAdminOption = createServerFn({ method: "POST" })
  .validator(
    z.object({
      optionId: uuidSchema,
      screeningId: uuidSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const { data: option, error: optionError } = await supabaseAdmin
      .from("poll_options")
      .select("id, tmdb_id")
      .eq("id", data.optionId)
      .eq("screening_id", data.screeningId)
      .maybeSingle();

    if (optionError) {
      throw optionError;
    }

    if (!option) {
      throw new Error("Ce film n’existe plus dans cette séance.");
    }

    const { error: deleteError } = await supabaseAdmin
      .from("poll_options")
      .delete()
      .eq("id", option.id);

    if (deleteError) {
      throw deleteError;
    }

    const { data: screening, error: screeningError } = await supabaseAdmin
      .from("screenings")
      .select("winner_movie_id")
      .eq("id", data.screeningId)
      .maybeSingle();

    if (screeningError) {
      throw screeningError;
    }

    if (screening?.winner_movie_id === option.tmdb_id) {
      const { error: winnerError } = await supabaseAdmin
        .from("screenings")
        .update({ winner_movie_id: null })
        .eq("id", data.screeningId);

      if (winnerError) {
        throw winnerError;
      }
    }

    return { success: true };
  });

export const setAdminWinner = createServerFn({ method: "POST" })
  .validator(
    z.object({
      screeningId: uuidSchema,
      tmdbId: z.number().int().positive().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();

    if (data.tmdbId !== null) {
      const { data: option, error: optionError } = await supabaseAdmin
        .from("poll_options")
        .select("id")
        .eq("screening_id", data.screeningId)
        .eq("tmdb_id", data.tmdbId)
        .maybeSingle();

      if (optionError) {
        throw optionError;
      }

      if (!option) {
        throw new Error("Ce film ne fait pas partie de cette séance.");
      }
    }

    const { error } = await supabaseAdmin
      .from("screenings")
      .update({ winner_movie_id: data.tmdbId })
      .eq("id", data.screeningId);

    if (error) {
      throw error;
    }

    return { success: true };
  });

export const resetAdminVotes = createServerFn({ method: "POST" })
  .validator(
    z.object({
      screeningId: uuidSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireAdminClient();
    const { error } = await supabaseAdmin
      .from("votes")
      .delete()
      .eq("screening_id", data.screeningId);

    if (error) {
      throw error;
    }

    return { success: true };
  });
