export const HEYGEN_PROMPT_TEMPLATE =
  "Create a {video_length_seconds}-second sales video for the SaaS product at {product_url}, " +
  "speaking to a {target_persona}, in {language}, in a friendly yet confident tone. " +
  "Explain the main benefits clearly.";

export interface HeygenPromptInput {
  video_length_seconds: number;
  product_url: string;
  target_persona: string;
  language: string;
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
  return [
    `Write a ${input.video_length_seconds}-second sales video script (about ${words} words) `,
    `for the SaaS product at ${input.product_url}, addressed to a ${input.target_persona}, `,
    `in ${input.language}. Friendly yet confident tone. Plain prose only — no stage directions, `,
    `no speaker labels, no markdown, no quotes. The presenter will read it verbatim. `,
    `Open with a hook, cover 2-3 concrete benefits, end with a short call to action.`,
  ].join("");
}