// HeyGen Avatar IV defaults.
// TODO: replace with real demo headshot URL (must be publicly fetchable by HeyGen).
export const DEMO_HEADSHOT_URL =
  "https://example.com/REPLACE_ME-demo-headshot.jpg";

// Curated HeyGen voices. IDs are real public voice_ids from HeyGen's
// /v2/voices catalog. Add or swap entries as desired.
export type HeygenVoice = {
  id: string;
  label: string;
  gender: "female" | "male";
  language: string;
};

export const HEYGEN_VOICES: HeygenVoice[] = [
  { id: "1bd001e7e50f421d891986aad5158bc8", label: "English – Female (Rachel)", gender: "female", language: "English" },
  { id: "d7bbcdd6964c47bdaae26decade4a933", label: "English – Male (Adam)", gender: "male", language: "English" },
  { id: "131a125ec1bb4a2280e1bbe23b6c5d5e", label: "English – Female (Anna, warm)", gender: "female", language: "English" },
  { id: "001cc6d54eae4ca2b5fb16ca8e8eb9ac", label: "Spanish – Female (Lucia)", gender: "female", language: "Spanish" },
  { id: "f7e1b2cb12e7460b9c7a8a1f1b9e5d8a", label: "French – Female (Camille)", gender: "female", language: "French" },
  { id: "26b2064088674c80b1e5fc5ab1a068ec", label: "German – Male (Felix)", gender: "male", language: "German" },
  { id: "73c0b6f2e3ad4f6db9e8b5d36b9e6a14", label: "Italian – Male (Marco)", gender: "male", language: "Italian" },
  { id: "5403a745860347beb7d342e07eb5e1f4", label: "Portuguese – Female (Beatriz)", gender: "female", language: "Portuguese" },
];

export const DEFAULT_AVATAR_IV_VOICE_ID = HEYGEN_VOICES[0].id;