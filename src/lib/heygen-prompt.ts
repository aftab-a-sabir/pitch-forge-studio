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
  return Math.max(20, Math.min(300, Math.round(seconds * 2.5)));
}

export function buildAvatarIVScriptPrompt(input: HeygenPromptInput): string {
  const words = targetWordCount(input.video_length_seconds);
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
    `Write a ${input.video_length_seconds}-second spoken sales video script (about ${words} words) `,
    `for the SaaS product whose website is ${input.product_url}, addressed to a ${input.target_persona}, `,
    `in ${input.language}. Friendly yet confident tone. Plain prose only — no stage directions, `,
    `no speaker labels, no markdown, no quotes, no URLs. Never read the website address aloud. `,
    `The presenter will read the script verbatim. `,
    `Open with a hook tied to a real pain the ${input.target_persona} feels, cover 2-3 concrete benefits `,
    `grounded in the product context below (do not invent features that are not supported by it), `,
    `and end with a short, action-oriented call to action (e.g. "see how it works", "try it free"). `,
    `If the product context is thin, stay generic and benefit-focused rather than fabricating specifics.`,
    contextBlock,
  ].join("");
}