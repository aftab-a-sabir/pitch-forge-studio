import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildHeygenPrompt } from "./heygen-prompt";

type HeygenVideoDetail = {
  id: string;
  status: string;
  title?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
  created_at?: number | null;
  completed_at?: number | null;
};

const HEYGEN_BASE = "https://api.heygen.com";

type HeygenSessionData = {
  session_id: string;
  status: string;
  video_id: string | null;
  created_at: number;
};

async function callHeygen<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
  const res = await fetch(`${HEYGEN_BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const err = (parsed as { error?: { message?: string; code?: string } } | null)?.error;
    const msg = err?.message ?? `HeyGen request failed (${res.status})`;
    console.error("heygen.error", { status: res.status, path, body: text.slice(0, 500) });
    throw new Error(msg);
  }
  return parsed as T;
}

export const createHeygenSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ prompt: z.string().min(1).max(10000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const json = await callHeygen<{ data: HeygenSessionData }>("/v3/video-agents", {
      method: "POST",
      body: JSON.stringify({ prompt: data.prompt, mode: "generate" }),
    });
    const session = json.data;
    console.log("heygen.session", {
      session_id: session.session_id,
      video_id: session.video_id,
      status: session.status,
    });
    return { session, raw: json };
  });

export const generateProjectVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, product_url, target_persona, target_languages, video_length_seconds")
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error(error?.message ?? "Project not found");

    const language = project.target_languages?.[0] ?? "English";
    const prompt = buildHeygenPrompt({
      video_length_seconds: project.video_length_seconds,
      product_url: project.product_url,
      target_persona: project.target_persona,
      language,
    });

    try {
      const json = await callHeygen<{ data: HeygenSessionData }>("/v3/video-agents", {
        method: "POST",
        body: JSON.stringify({ prompt, mode: "generate" }),
      });
      const session = json.data;
      console.log("heygen.session", {
        project_id: project.id,
        session_id: session.session_id,
        video_id: session.video_id,
      });
      const { error: updateErr } = await supabase
        .from("projects")
        .update({
          heygen_session_id: session.session_id,
          heygen_video_id: session.video_id,
          heygen_last_error: null,
          status: "Generating",
        })
        .eq("id", project.id);
      if (updateErr) throw new Error(updateErr.message);
      return {
        session_id: session.session_id,
        video_id: session.video_id,
        status: session.status,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabase
        .from("projects")
        .update({ heygen_last_error: message, status: "Failed" })
        .eq("id", project.id);
      throw e;
    }
  });

export const listHeygenSessionVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const json = await callHeygen<{ data: HeygenVideoDetail[]; has_more?: boolean; next_token?: string | null }>(
      `/v3/video-agents/${encodeURIComponent(data.sessionId)}/videos`,
      { method: "GET" },
    );
    return { videos: json.data ?? [], has_more: json.has_more ?? false, next_token: json.next_token ?? null };
  });