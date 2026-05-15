# Fix HeyGen "Invalid voice_id" error

Replace the `REPLACE_ME_VOICE_ID` placeholder with a real voice picker so HeyGen accepts the request.

## What we're building (Option 2 + Option 4)

- **Curated dropdown** of ~8 hand-picked HeyGen voices (label + gender + language).
- **"Other / paste voice_id"** option that reveals a free-text input for power users.
- **Per-project storage** so each project remembers its voice.
- **Recovery for the failed project**: edit it, pick a voice, re-run generation.

## Steps

### 1. Voice catalog (`src/lib/heygen-config.ts`)
Replace placeholders with a real catalog:
```ts
export const HEYGEN_VOICES = [
  { id: "<real-id>", label: "English – Female (Rachel)", gender: "female", language: "English" },
  { id: "<real-id>", label: "English – Male (Adam)",   gender: "male",   language: "English" },
  // ~6 more covering the languages in ALL_LANGUAGES
];
export const DEFAULT_AVATAR_IV_VOICE_ID = HEYGEN_VOICES[0].id;
```
IDs sourced from HeyGen's public `/v2/voices` list.

### 2. Database
Migration: add nullable `voice_id text` column to `projects`.

### 3. Server functions (`src/lib/projects.functions.ts`)
- Add `voice_id: z.string().min(1).max(128).nullable().optional()` to create + update schemas.
- Persist on insert/update; include in `getProject` / `listProjects` selects.

### 4. Generation (`src/lib/heygen.functions.ts`)
- Select `voice_id` from the project row.
- Pass `project.voice_id ?? DEFAULT_AVATAR_IV_VOICE_ID` to the `/v2/videos` payload.

### 5. UI (`src/routes/new.tsx`)
- New "Voice" `<Select>` populated from `HEYGEN_VOICES`, plus a final "Other — paste voice_id" option that reveals a text input.
- Hydrate from existing project on edit.
- Submit alongside other fields.

### 6. Verify
- Edit the existing failed project, pick a voice, save → status resets to `pending`.
- Trigger generation → confirm HeyGen accepts the call (check server logs).

## Out of scope
- Live `/v2/voices` browser with search — can add later.
- Auto-picking voice from `target_languages[0]` — manual for now.
