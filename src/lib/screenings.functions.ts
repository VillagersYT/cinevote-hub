import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ScreeningInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  poll_opens_at: z.string().optional().nullable(),
  poll_closes_at: z.string().optional().nullable(),
  allow_public_proposals: z.boolean(),
  max_proposals_per_voter: z.number().int().min(1).max(50),
  votes_per_voter: z.number().int().min(1).max(50),
  status: z.enum(["open", "closed", "finished"]),
  cover_url: z.string().url().optional().nullable().or(z.literal("")),
  winner_movie_id: z.number().int().nullable().optional(),
});

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const saveScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScreeningInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const payload = {
      ...data,
      cover_url: data.cover_url || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("screenings").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("screenings")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("screenings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("poll_options").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        site_name: z.string().min(1).max(100),
        tagline: z.string().max(200).optional().nullable(),
        primary_color: z.string().max(30).optional().nullable(),
        accent_color: z.string().max(30).optional().nullable(),
        hero_image_url: z.string().url().optional().nullable().or(z.literal("")),
        about_text: z.string().max(4000).optional().nullable(),
        footer_text: z.string().max(500).optional().nullable(),
        default_votes_per_voter: z.number().int().min(1).max(50),
        default_max_proposals: z.number().int().min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const payload = { ...data, id: 1, hero_image_url: data.hero_image_url || null };
    const { error } = await context.supabase.from("site_settings").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });
