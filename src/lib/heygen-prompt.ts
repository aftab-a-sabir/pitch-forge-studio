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