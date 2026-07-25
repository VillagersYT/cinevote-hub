import { z } from "zod";

import {
  createSupabaseAuthenticatedClient,
  getVerifiedSupabaseAdminClient,
  SupabaseAdminKeyConfigurationError,
  verifySupabaseAccessToken,
} from "@/integrations/supabase/client.server";

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

const adminActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("getDashboard"),
    data: z.object({}),
  }),
  z.object({
    action: z.literal("getScreeningContent"),
    data: z.object({
      screeningId: uuidSchema,
    }),
  }),
  z.object({
    action: z.literal("saveScreening"),
    data: z.object({
      screening: screeningPayloadSchema,
      screeningId: uuidSchema.nullable(),
    }),
  }),
  z.object({
    action: z.literal("deleteScreening"),
    data: z.object({
      screeningId: uuidSchema,
    }),
  }),
  z.object({
    action: z.literal("duplicateScreening"),
    data: z.object({
      screeningId: uuidSchema,
    }),
  }),
  z.object({
    action: z.literal("updateScreeningStatus"),
    data: z.object({
      screeningId: uuidSchema,
      status: z.enum(["open", "closed", "finished"]),
    }),
  }),
  z.object({
    action: z.literal("saveSettings"),
    data: z.object({
      settings: settingsPayloadSchema,
    }),
  }),
  z.object({
    action: z.literal("addMovie"),
    data: z.object({
      movie: moviePayloadSchema,
      screeningId: uuidSchema,
    }),
  }),
  z.object({
    action: z.literal("deleteOption"),
    data: z.object({
      optionId: uuidSchema,
      screeningId: uuidSchema,
    }),
  }),
  z.object({
    action: z.literal("setWinner"),
    data: z.object({
      screeningId: uuidSchema,
      tmdbId: z.number().int().positive().nullable(),
    }),
  }),
  z.object({
    action: z.literal("resetVotes"),
    data: z.object({
      screeningId: uuidSchema,
    }),
  }),
]);

function requireRecord<T>(data: T | null, message: string): T {
  if (data === null) {
    throw new Error(message);
  }

  return data;
}

async function requireAuthenticatedUser(authorization: string | null): Promise<string> {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Session administrateur absente. Déconnecte-toi puis reconnecte-toi.");
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  if (!accessToken) {
    throw new Error("Session administrateur invalide. Déconnecte-toi puis reconnecte-toi.");
  }

  await verifySupabaseAccessToken(accessToken);
  return accessToken;
}

async function getAdminDatabaseClient(accessToken: string) {
  try {
    return await getVerifiedSupabaseAdminClient();
  } catch (error) {
    if (!(error instanceof SupabaseAdminKeyConfigurationError)) {
      throw error;
    }

    // The project policy intentionally grants administration to every authenticated
    // account. This keeps the panel usable when a stale Vercel server key is present.
    console.warn("[Supabase admin] falling back to the verified authenticated user session.");
    return createSupabaseAuthenticatedClient(accessToken);
  }
}

export async function handleAdminAction({
  authorization,
  body,
}: {
  authorization: string | null;
  body: unknown;
}) {
  const accessToken = await requireAuthenticatedUser(authorization);
  const supabaseAdmin = await getAdminDatabaseClient(accessToken);

  const payload = adminActionSchema.parse(body);

  switch (payload.action) {
    case "getDashboard": {
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
    }

    case "getScreeningContent": {
      const [optionsResult, votesResult] = await Promise.all([
        supabaseAdmin
          .from("poll_options")
          .select("*")
          .eq("screening_id", payload.data.screeningId)
          .order("created_at"),
        supabaseAdmin.from("votes").select("*").eq("screening_id", payload.data.screeningId),
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

    case "saveScreening": {
      const { poll_closes_at: pollClosesAt, poll_opens_at: pollOpensAt } = payload.data.screening;

      if (
        pollOpensAt &&
        pollClosesAt &&
        new Date(pollOpensAt).getTime() >= new Date(pollClosesAt).getTime()
      ) {
        throw new Error("La fermeture du sondage doit être après son ouverture.");
      }

      if (payload.data.screeningId) {
        const { data, error } = await supabaseAdmin
          .from("screenings")
          .update(payload.data.screening)
          .eq("id", payload.data.screeningId)
          .select("id")
          .maybeSingle();

        if (error) {
          throw error;
        }

        return requireRecord(data, "Cette séance n’existe plus.").id;
      }

      const { data, error } = await supabaseAdmin
        .from("screenings")
        .insert(payload.data.screening)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      return requireRecord(data, "La séance n’a pas été créée.").id;
    }

    case "deleteScreening": {
      const { data, error } = await supabaseAdmin
        .from("screenings")
        .delete()
        .eq("id", payload.data.screeningId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return requireRecord(data, "Cette séance n’existe plus.").id;
    }

    case "duplicateScreening": {
      const { data: source, error: sourceError } = await supabaseAdmin
        .from("screenings")
        .select("*")
        .eq("id", payload.data.screeningId)
        .maybeSingle();

      if (sourceError) {
        throw sourceError;
      }

      if (!source) {
        throw new Error("Cette séance n’existe plus.");
      }

      const { data, error } = await supabaseAdmin
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

      return requireRecord(data, "La copie n’a pas été créée.").id;
    }

    case "updateScreeningStatus": {
      const { data, error } = await supabaseAdmin
        .from("screenings")
        .update({ status: payload.data.status })
        .eq("id", payload.data.screeningId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      requireRecord(data, "Cette séance n’existe plus.");
      return { success: true as const };
    }

    case "saveSettings": {
      const { data, error } = await supabaseAdmin
        .from("site_settings")
        .upsert({
          ...payload.data.settings,
          id: 1,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      requireRecord(data, "Les réglages n’ont pas été enregistrés.");
      return { success: true as const };
    }

    case "addMovie": {
      const { data, error } = await supabaseAdmin
        .from("poll_options")
        .insert({
          backdrop_path: payload.data.movie.backdrop_path,
          original_title: payload.data.movie.original_title,
          overview: payload.data.movie.overview,
          poster_path: payload.data.movie.poster_path,
          proposer_name: "Administration",
          proposer_voter_id: null,
          release_year: payload.data.movie.release_year,
          runtime: payload.data.movie.runtime,
          screening_id: payload.data.screeningId,
          title: payload.data.movie.title,
          tmdb_id: payload.data.movie.id,
        })
        .select("id")
        .single();

      if (error?.code === "23505") {
        throw new Error("Ce film est déjà présent dans cette séance.");
      }

      if (error) {
        throw error;
      }

      requireRecord(data, "Le film n’a pas été ajouté.");
      return { success: true as const };
    }

    case "deleteOption": {
      const { data: option, error: optionError } = await supabaseAdmin
        .from("poll_options")
        .select("id, tmdb_id")
        .eq("id", payload.data.optionId)
        .eq("screening_id", payload.data.screeningId)
        .maybeSingle();

      if (optionError) {
        throw optionError;
      }

      if (!option) {
        throw new Error("Ce film n’existe plus dans cette séance.");
      }

      const { data: deleted, error: deleteError } = await supabaseAdmin
        .from("poll_options")
        .delete()
        .eq("id", option.id)
        .select("id")
        .maybeSingle();

      if (deleteError) {
        throw deleteError;
      }

      requireRecord(deleted, "Ce film n’existe plus dans cette séance.");

      const { data: screening, error: screeningError } = await supabaseAdmin
        .from("screenings")
        .select("winner_movie_id")
        .eq("id", payload.data.screeningId)
        .maybeSingle();

      if (screeningError) {
        throw screeningError;
      }

      if (screening?.winner_movie_id === option.tmdb_id) {
        const { error: winnerError } = await supabaseAdmin
          .from("screenings")
          .update({ winner_movie_id: null })
          .eq("id", payload.data.screeningId);

        if (winnerError) {
          throw winnerError;
        }
      }

      return { success: true as const };
    }

    case "setWinner": {
      if (payload.data.tmdbId !== null) {
        const { data: option, error: optionError } = await supabaseAdmin
          .from("poll_options")
          .select("id")
          .eq("screening_id", payload.data.screeningId)
          .eq("tmdb_id", payload.data.tmdbId)
          .maybeSingle();

        if (optionError) {
          throw optionError;
        }

        if (!option) {
          throw new Error("Ce film ne fait pas partie de cette séance.");
        }
      }

      const { data, error } = await supabaseAdmin
        .from("screenings")
        .update({ winner_movie_id: payload.data.tmdbId })
        .eq("id", payload.data.screeningId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      requireRecord(data, "Cette séance n’existe plus.");
      return { success: true as const };
    }

    case "resetVotes": {
      const { error } = await supabaseAdmin
        .from("votes")
        .delete()
        .eq("screening_id", payload.data.screeningId);

      if (error) {
        throw error;
      }

      return { success: true as const };
    }
  }
}
