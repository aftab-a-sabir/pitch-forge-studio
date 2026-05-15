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
});

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
      .select("id, product_url, target_persona, target_languages, video_length_seconds, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { projects: data ?? [] };
  });
