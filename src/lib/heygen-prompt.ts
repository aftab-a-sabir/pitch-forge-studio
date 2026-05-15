export const HEYGEN_PROMPT_TEMPLATE =
  "Create a {video_length_seconds}-second sales video for the SaaS product at {product_url}, " +
  "speaking to a {target_persona}, in {language}, in a friendly yet confident tone. " +
  "Explain the main benefits clearly.";

export interface HeygenPromptInput {
  video_length_seconds: number;
  product_url: string;
  target_persona: string;
  language: string;
  product_summary?: string | null;
  page_context?: string | null;
}

export function buildHeygenPrompt(input: HeygenPromptInput): string {
  const map = input as unknown as Record<string, unknown>;
  return HEYGEN_PROMPT_TEMPLATE.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = map[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

// Roughly 2.5 spoken words per second.
export function targetWordCount(seconds: number): number {
  // Avatar IV voices average ~2.7 spoken words per second. We aim slightly
  // high so the rendered video lands at or just over the requested length.
  return Math.max(25, Math.min(360, Math.round(seconds * 2.7)));
}

export function buildAvatarIVScriptPrompt(input: HeygenPromptInput): string {
  const target = targetWordCount(input.video_length_seconds);
  const min = Math.round(target * 0.9);
  const max = Math.round(target * 1.1);
  const contextParts: string[] = [];
  if (input.product_summary && input.product_summary.trim()) {
    contextParts.push(`Product summary (provided by the seller):\n${input.product_summary.trim()}`);
  }
  if (input.page_context && input.page_context.trim()) {
    contextParts.push(`Extracted from the product website:\n${input.page_context.trim()}`);
  }
  const contextBlock = contextParts.length
    ? `\n\nProduct context — base every concrete claim on this material:\n\n${contextParts.join("\n\n")}\n`
    : "";
  return [
    `You are writing a ${input.video_length_seconds}-second spoken sales video script in ${input.language}, `,
    `addressed to a ${input.target_persona}. The on-screen presenter will read it verbatim.\n\n`,
    `HARD LENGTH REQUIREMENT: write between ${min} and ${max} words (target ~${target}). `,
    `Do not stop early. If you finish a draft shorter than ${min} words, keep going by deepening the benefits `,
    `or sharpening the call to action — never pad with filler or repeat yourself.\n\n`,
    `OUTPUT RULES: plain prose only. No stage directions, no speaker labels, no headings, `,
    `no markdown, no quotation marks, no bullet points, no URLs. Never speak the website address aloud. `,
    `Never invent product features that are not supported by the context below.\n\n`,
    `STRUCTURE (4 beats, flow them together as natural prose, do not label them):\n`,
    `1. Hook — open on a real pain the ${input.target_persona} feels day to day.\n`,
    `2. Reveal — name the product and what it does in one clear sentence.\n`,
    `3. Benefits — 2 to 3 concrete, specific benefits, each grounded in the product context.\n`,
    `4. Call to action — one short, confident line (e.g. "see how it works today", "try it free this week").\n`,
    `Tone: friendly, confident, energetic — like a senior product marketer pitching on stage.\n`,
    `If the product context is thin, stay benefit-focused and generic rather than fabricating specifics.`,
    contextBlock,
  ].join("");
}

export function buildAvatarIVExpansionPrompt(args: {
  draft: string;
  min_words: number;
  target_words: number;
}): string {
  return [
    `The script below is too short. Rewrite it so it has at least ${args.min_words} words `,
    `(ideally ~${args.target_words}). Deepen the benefits and sharpen the call to action. `,
    `Keep the same friendly, confident tone. Do not repeat sentences, do not pad with filler, `,
    `do not add stage directions, headings, markdown, quotes, or URLs. Output the rewritten script only.\n\n`,
    `Draft:\n${args.draft}`,
  ].join("");
}