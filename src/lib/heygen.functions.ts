import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildHeygenPrompt } from "./heygen-prompt";
import { generateScript } from "./script.functions";
import { DEFAULT_AVATAR_IV_VOICE_ID } from "./heygen-config";

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

type HeygenV2VideoCreateResponse = {
  data: { video_id: string };
};

type HeygenV2VideoStatus = {
  data: {
    id?: string;
    status: string;
    video_url?: string | null;
    thumbnail_url?: string | null;
    error?: { message?: string } | null;
  };
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

export const generateProjectVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select(
        "id, product_url, product_summary, target_persona, target_languages, video_length_seconds, headshot_url, voice_id, script",
      )
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error(error?.message ?? "Project not found");

    const language = project.target_languages?.[0] ?? "English";

    try {
      // Avatar IV (image-to-video) path when a headshot is provided.
      if (project.headshot_url) {
        let script = project.script?.trim() || "";
        if (!script) {
          // Backward compatibility: if no stored script (e.g. an older project), generate one now.
          const result = await generateScript({ data: { projectId: project.id } });
          script = result.script;
        }
        const json = await callHeygen<HeygenV2VideoCreateResponse>("/v2/videos", {
          method: "POST",
          body: JSON.stringify({
            image_url: project.headshot_url,
            script,
            voice_id: project.voice_id ?? DEFAULT_AVATAR_IV_VOICE_ID,
            resolution: "1080p",
            aspect_ratio: "16:9",
            expressiveness: "high",
          }),
        });
        const videoId = json.data?.video_id;
        if (!videoId) throw new Error("HeyGen Avatar IV did not return a video_id");
        console.log("heygen.avatar_iv", { project_id: project.id, video_id: videoId });
        const { error: updateErr } = await supabase
          .from("projects")
          .update({
            heygen_session_id: null,
            heygen_video_id: videoId,
            heygen_last_error: null,
            status: "processing",
          })
          .eq("id", project.id);
        if (updateErr) throw new Error(updateErr.message);
        return { session_id: null, video_id: videoId, status: "processing" };
      }

      // Default path: Video Agents.
      const prompt = buildHeygenPrompt({
        video_length_seconds: project.video_length_seconds,
        product_url: project.product_url,
        target_persona: project.target_persona,
        language,
      });
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
          status: "processing",
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
        .update({ heygen_last_error: message, status: "error" })
        .eq("id", project.id);
      throw e;
    }
  });

export const checkProjectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, status, heygen_session_id, heygen_video_id, video_url")
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error(error?.message ?? "Project not found");

    if (project.status === "ready" && project.video_url) {
      return { status: "ready", video_url: project.video_url, changed: false };
    }

    // Avatar IV path: poll /v2/videos/{video_id} when no session id but a video id exists.
    if (!project.heygen_session_id && project.heygen_video_id) {
      let v2: HeygenV2VideoStatus["data"];
      try {
        const json = await callHeygen<HeygenV2VideoStatus>(
          `/v1/video_status.get?video_id=${encodeURIComponent(project.heygen_video_id)}`,
          { method: "GET" },
        );
        v2 = json.data;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await supabase.from("projects").update({ heygen_last_error: message }).eq("id", project.id);
        throw e;
      }
      const heyStatus = (v2?.status ?? "").toLowerCase();
      let nextStatus: "processing" | "ready" | "error" = "processing";
      if (heyStatus === "completed" || heyStatus === "ready" || heyStatus === "succeeded") {
        nextStatus = "ready";
      } else if (heyStatus === "failed" || heyStatus === "error") {
        nextStatus = "error";
      }
      const videoUrl = v2?.video_url ?? null;
      const updates: { status: "processing" | "ready" | "error"; video_url?: string } = {
        status: nextStatus,
      };
      if (nextStatus === "ready" && videoUrl) updates.video_url = videoUrl;
      const { error: updateErr } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", project.id);
      if (updateErr) throw new Error(updateErr.message);
      return {
        status: nextStatus,
        video_url: nextStatus === "ready" ? videoUrl : null,
        heygen_status: v2?.status,
        changed:
          nextStatus !== project.status ||
          (nextStatus === "ready" && videoUrl !== project.video_url),
      };
    }

    if (!project.heygen_session_id) {
      return { status: project.status, video_url: project.video_url ?? null, changed: false };
    }

    let videos: HeygenVideoDetail[] = [];
    try {
      const json = await callHeygen<{ data: HeygenVideoDetail[] }>(
        `/v3/video-agents/${encodeURIComponent(project.heygen_session_id)}/videos`,
        { method: "GET" },
      );
      videos = json.data ?? [];
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabase.from("projects").update({ heygen_last_error: message }).eq("id", project.id);
      throw e;
    }

    const match =
      (project.heygen_video_id && videos.find((v) => v.id === project.heygen_video_id)) ||
      videos[0] ||
      null;

    if (!match) {
      return { status: project.status, video_url: null, changed: false };
    }

    const heyStatus = (match.status ?? "").toLowerCase();
    let nextStatus: "processing" | "ready" | "error" = "processing";
    if (heyStatus === "completed" || heyStatus === "ready" || heyStatus === "succeeded") {
      nextStatus = "ready";
    } else if (heyStatus === "failed" || heyStatus === "error") {
      nextStatus = "error";
    }

    const videoUrl = match.video_url ?? null;
    const updates: {
      status: "processing" | "ready" | "error";
      video_url?: string;
      heygen_video_id?: string;
    } = { status: nextStatus };
    if (nextStatus === "ready" && videoUrl) updates.video_url = videoUrl;
    if (!project.heygen_video_id && match.id) updates.heygen_video_id = match.id;

    const { error: updateErr } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", project.id);
    if (updateErr) throw new Error(updateErr.message);

    return {
      status: nextStatus,
      video_url: nextStatus === "ready" ? videoUrl : null,
      heygen_status: match.status,
      changed:
        nextStatus !== project.status || (nextStatus === "ready" && videoUrl !== project.video_url),
    };
  });
