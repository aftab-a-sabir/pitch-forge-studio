import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { researchProduct } from "./research.functions";
import { targetWordCount } from "./heygen-prompt";

type ProductBrief = {
  name: string;
  value_prop: string;
  audience: string;
  features: string[];
  tone: string;
};

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

async function callAI(args: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI gateway returned empty content");
  return text;
}

function buildScriptPrompt(args: {
  brief: ProductBrief;
  persona: string;
  language: string;
  seconds: number;
  target: number;
  min: number;
  max: number;
}): string {
  const { brief, persona, language, seconds, target, min, max } = args;
  return [
    `Write a ${seconds}-second spoken sales video script in ${language}, addressed to a ${persona}. `,
    `An on-screen presenter will read it verbatim.\n\n`,
    `HARD LENGTH REQUIREMENT: between ${min} and ${max} words (target ~${target}). Do not stop early.\n\n`,
    `OUTPUT RULES: plain prose only. No stage directions, speaker labels, headings, markdown, quotes, `,
    `bullet points, or URLs. Never speak the website address aloud. Never invent features that are not in the brief.\n\n`,
    `STRUCTURE (4 beats, blended into natural prose, do not label them):\n`,
    `1. Hook — a real pain or aspiration the ${persona} feels.\n`,
    `2. Reveal — name the product (${brief.name}) and what it does in one sentence.\n`,
    `3. Benefits — 2 to 3 concrete benefits grounded in the features below.\n`,
    `4. Call to action — one short, confident closing line.\n\n`,
    `Tone: ${brief.tone}, but always friendly and confident.\n\n`,
    `PRODUCT BRIEF:\n`,
    `Name: ${brief.name}\n`,
    `Value proposition: ${brief.value_prop}\n`,
    `Audience: ${brief.audience}\n`,
    `Features:\n${brief.features.map((f) => `- ${f}`).join("\n")}\n`,
  ].join("");
}

function buildExpansionPrompt(args: { draft: string; min: number; target: number }): string {
  return [
    `The script below is too short. Rewrite it so it has at least ${args.min} words `,
    `(ideally ~${args.target}). Deepen the benefits and sharpen the call to action. `,
    `Keep the tone. No repetition, no filler, no stage directions, headings, markdown, quotes, or URLs. `,
    `Output only the rewritten script.\n\nDraft:\n${args.draft}`,
  ].join("");
}

async function ensureBrief(
  projectId: string,
  existing: ProductBrief | null,
): Promise<ProductBrief> {
  if (existing && Array.isArray(existing.features) && existing.features.length > 0) {
    return existing;
  }
  const { brief } = await researchProduct({ data: { projectId } });
  return brief as ProductBrief;
}

export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { data: project, error } = await supabase
      .from("projects")
      .select(
        "id, product_url, product_summary, target_persona, target_languages, video_length_seconds, product_brief",
      )
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error(error?.message ?? "Project not found");

    const brief = await ensureBrief(
      project.id,
      (project.product_brief as ProductBrief | null) ?? null,
    );

    const language = project.target_languages?.[0] ?? "English";
    const target = targetWordCount(project.video_length_seconds);
    const min = Math.round(target * 0.9);
    const max = Math.round(target * 1.1);

    const system =
      "You are a senior product marketer writing spoken sales scripts that on-screen avatars read verbatim. " +
      "Output plain text only. Hit the requested word count.";

    const userPrompt = buildScriptPrompt({
      brief,
      persona: project.target_persona,
      language,
      seconds: project.video_length_seconds,
      target,
      min,
      max,
    });

    const model = "google/gemini-3-flash-preview";
    console.log("script.generate.start", {
      project_id: project.id,
      model,
      target_words: target,
    });
    let draft = await callAI({ apiKey, model, system, user: userPrompt });

    let words = countWords(draft);
    let retried = false;
    if (words < min) {
      retried = true;
      try {
        const expanded = await callAI({
          apiKey,
          model,
          system,
          user: buildExpansionPrompt({ draft, min, target }),
        });
        const expandedWords = countWords(expanded);
        if (expandedWords > words) {
          draft = expanded;
          words = expandedWords;
        }
      } catch (e) {
        console.warn("script.expand_failed", e instanceof Error ? e.message : e);
      }
    }

    const updated_at = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("projects")
      .update({ script: draft, script_updated_at: updated_at })
      .eq("id", project.id);
    if (updateErr) throw new Error(updateErr.message);

    console.log("heygen.script", {
      project_id: project.id,
      model,
      target_words: target,
      min_words: min,
      words,
      retried,
    });

    return { script: draft, words, target_words: target, script_updated_at: updated_at };
  });

export const saveScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        script: z.string().min(1).max(20_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("projects")
      .update({ script: data.script, script_updated_at: updated_at })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { script_updated_at: updated_at, words: countWords(data.script) };
  });