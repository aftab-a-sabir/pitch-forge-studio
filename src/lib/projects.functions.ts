import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_LANGUAGES } from "./languages";

export const TARGET_PERSONAS = ["Founder", "CFO", "HR Manager", "IT Lead"] as const;

const createProjectSchema = z.object({
  product_url: z.string().url().max(2048),
  product_summary: z.string().max(5000).optional().nullable(),
  target_persona: z.enum(TARGET_PERSONAS),
  target_languages: z.array(z.enum(ALL_LANGUAGES)).min(1).max(ALL_LANGUAGES.length),
  video_length_seconds: z.number().int().min(15).max(120).default(45),
  headshot_url: z.string().url().max(2048).optional().nullable(),
  voice_id: z.string().min(1).max(128).optional().nullable(),
});

const updateProjectSchema = createProjectSchema.extend({
  projectId: z.string().uuid(),
});

const projectIdSchema = z.object({ projectId: z.string().uuid() });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createProjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        product_url: data.product_url,
        product_summary: data.product_summary ?? null,
        target_persona: data.target_persona,
        target_languages: data.target_languages,
        video_length_seconds: data.video_length_seconds,
        headshot_url: data.headshot_url ?? null,
        voice_id: data.voice_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("projects")
      .select("id, product_url, target_persona, target_languages, video_length_seconds, status, created_at, heygen_session_id, heygen_video_id, heygen_last_error, video_url, headshot_url, voice_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { projects: data ?? [] };
  });

export const getProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("projects")
      .select("id, product_url, product_summary, target_persona, target_languages, video_length_seconds, status, created_at, heygen_session_id, heygen_video_id, heygen_last_error, video_url, headshot_url, voice_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found");
    return { project: row };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing, error: fetchErr } = await supabase
      .from("projects")
      .select("status")
      .eq("id", data.projectId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error("Project not found");

    const baseUpdates = {
      product_url: data.product_url,
      product_summary: data.product_summary ?? null,
      target_persona: data.target_persona,
      target_languages: data.target_languages,
      video_length_seconds: data.video_length_seconds,
      headshot_url: data.headshot_url ?? null,
      voice_id: data.voice_id ?? null,
    };
    const updates = existing.status === "error"
      ? {
          ...baseUpdates,
          status: "pending",
          heygen_last_error: null,
          heygen_session_id: null,
          heygen_video_id: null,
          video_url: null,
        }
      : baseUpdates;

    const { error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { id: data.projectId };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Best-effort: remove headshot file from storage if it lives in our bucket.
    const { data: existing } = await supabase
      .from("projects")
      .select("headshot_url")
      .eq("id", data.projectId)
      .maybeSingle();
    const headshotUrl = existing?.headshot_url ?? null;
    if (headshotUrl) {
      const marker = "/storage/v1/object/public/headshots/";
      const idx = headshotUrl.indexOf(marker);
      if (idx !== -1) {
        const path = decodeURIComponent(headshotUrl.slice(idx + marker.length));
        try {
          await supabase.storage.from("headshots").remove([path]);
        } catch {
          // ignore — deletion of the row is the primary action
        }
      }
    }
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
