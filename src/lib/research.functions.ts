import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ProductBrief = {
  name: string;
  value_prop: string;
  audience: string;
  features: string[];
  tone: string;
};

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function fetchReadable(url: string): Promise<{
  title: string | null;
  description: string | null;
  text: string;
}> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; LovableScriptBot/1.0; +https://lovable.dev)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("text/html") && !ctype.includes("xml")) {
    throw new Error("Page did not return HTML");
  }
  let html = await res.text();
  if (html.length > 400_000) html = html.slice(0, 400_000);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).replace(/\s+/g, " ").trim() : null;
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const description = descMatch ? decodeEntities(descMatch[1]).trim() : null;

  // Strip script/style/noscript blocks before tag-stripping.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  const text = decodeEntities(stripTags(cleaned)).replace(/\s+/g, " ").trim();

  return { title, description, text: text.slice(0, 15_000) };
}

async function extractBrief(args: {
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  fallback_summary: string | null;
  apiKey: string;
}): Promise<ProductBrief> {
  const userPrompt = [
    `Source URL: ${args.url}`,
    args.title ? `Page title: ${args.title}` : null,
    args.description ? `Meta description: ${args.description}` : null,
    args.fallback_summary
      ? `Seller-provided description:\n${args.fallback_summary}`
      : null,
    `Page text (truncated):\n${args.text}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a product research analyst. From the supplied web page text, extract a structured brief about the product. " +
            "Be specific and concrete; never invent features that are not in the source.",
        },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "record_brief",
            description: "Record the structured product brief.",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Product or company name." },
                value_prop: {
                  type: "string",
                  description: "One-sentence value proposition.",
                },
                audience: {
                  type: "string",
                  description: "Primary audience or buyer persona for the product.",
                },
                features: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5,
                  description: "3-5 concrete product features or capabilities.",
                },
                tone: {
                  type: "string",
                  description: "Brand tone (e.g. friendly, technical, playful, premium).",
                },
              },
              required: ["name", "value_prop", "audience", "features", "tone"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "record_brief" } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{
      message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
    }>;
  };
  const argStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argStr) throw new Error("AI gateway returned no tool call");
  const parsed = JSON.parse(argStr) as ProductBrief;
  if (!Array.isArray(parsed.features)) parsed.features = [];
  return parsed;
}

export const researchProduct = createServerFn({ method: "POST" })
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
      .select("id, product_url, product_summary")
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error(error?.message ?? "Project not found");

    let scrape: { title: string | null; description: string | null; text: string };
    try {
      scrape = await fetchReadable(project.product_url);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("research.fetch_failed", { project_id: project.id, message });
      scrape = { title: null, description: null, text: "" };
    }

    const summary = project.product_summary?.trim() ?? "";
    const haveContext =
      scrape.text.length >= 500 ||
      (scrape.description?.length ?? 0) > 40 ||
      summary.length >= 80;
    if (!haveContext) {
      throw new Error(
        "Could not read enough information from the product URL. Please add a short product description and try again.",
      );
    }

    const brief = await extractBrief({
      url: project.product_url,
      title: scrape.title,
      description: scrape.description,
      text: scrape.text,
      fallback_summary: summary || null,
      apiKey,
    });

    const { error: updateErr } = await supabase
      .from("projects")
      .update({ product_brief: brief })
      .eq("id", project.id);
    if (updateErr) throw new Error(updateErr.message);

    console.log("research.brief", {
      project_id: project.id,
      features: brief.features.length,
    });
    return { brief };
  });