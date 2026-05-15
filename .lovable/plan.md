# Headshot upload/URL + HeyGen Avatar IV workflow

## Goal

On the New Project form, let the user provide a presenter headshot in any of three ways: paste a public image URL, upload a file from the device, or use a bundled demo headshot. When a project has a headshot, the backend uses HeyGen's **Avatar IV** image-to-video endpoint (`POST /v2/videos` with `image_url`) instead of the default Video Agents flow.

## UX changes (`src/routes/new.tsx`)

New "Presenter headshot (optional)" section using a `Tabs` control with three tabs:

1. **URL** — `<Input type="url">` for a publicly reachable image URL. Live preview thumbnail.
2. **Upload** — `<Input type="file" accept="image/png, image/jpeg">`, ≤ 5 MB. Live preview from object URL.
3. **Demo** — single-click "Use demo headshot" using a bundled known-good image. Shows the demo thumbnail.

Behavior:
- Only the active tab's value is used at submit time; switching tabs clears the others.
- Field is fully optional. Empty → existing Video Agents flow.
- On submit:
  - URL tab → send the URL as-is (validated with `z.string().url()`).
  - Upload tab → upload to Supabase Storage bucket `headshots` at `${userId}/${uuid}-${filename}`, take the resulting public URL.
  - Demo tab → use the constant `DEMO_HEADSHOT_URL`.
  - Pass the resolved public URL as `headshot_url` to `createProject`.

## Data model (`supabase--migration`)

- `ALTER TABLE public.projects ADD COLUMN headshot_url text NULL;`
- Create public storage bucket `headshots` with RLS:
  - Public `SELECT` (so HeyGen can fetch the image).
  - Authenticated `INSERT`/`UPDATE`/`DELETE` only when `auth.uid()::text = (storage.foldername(name))[1]`.

## Server changes

### `src/lib/projects.functions.ts`
- Extend `createProjectSchema` with `headshot_url: z.string().url().max(2048).optional().nullable()`.
- Persist on insert; include in `listProjects` select.

### `src/lib/heygen.functions.ts`
- In `generateProjectVideo`, branch on `project.headshot_url`:
  - **No headshot → existing Video Agents path** (`POST /v3/video-agents`).
  - **Headshot present → Avatar IV path**:
    1. Generate a short spoken script (≤ ~120 words to fit `video_length_seconds`) via Lovable AI Gateway (`google/gemini-2.5-flash`) from product/persona/language inputs. New helper `buildAvatarIVScript(...)` in `src/lib/heygen-prompt.ts`.
    2. `POST https://api.heygen.com/v2/videos`:
       ```json
       {
         "image_url": "<headshot_url>",
         "script": "<generated script>",
         "voice_id": "<DEFAULT_AVATAR_IV_VOICE_ID>",
         "resolution": "1080p",
         "aspect_ratio": "16:9",
         "expressiveness": "medium"
       }
       ```
    3. Save `heygen_video_id`; leave `heygen_session_id` null so the polling branch knows which path to take. `status = 'processing'`.
- In `checkProjectStatus`:
  - If `heygen_session_id` is set → existing `/v3/video-agents/{id}/videos` polling.
  - Else if `heygen_video_id` is set → `GET /v2/videos/{video_id}`; map `data.status` (`completed` / `processing` / `failed`) and `data.video_url` into the row the same way.

### Constants (new `src/lib/heygen-config.ts`)
- `DEMO_HEADSHOT_URL` — placeholder string (clearly marked `TODO: replace with real demo headshot URL`).
- `DEFAULT_AVATAR_IV_VOICE_ID` — placeholder string (clearly marked `TODO: replace with real HeyGen voice_id`).

Both placeholders are wired through end-to-end so the feature compiles and renders; you swap the two string values later when you have the real assets. Avatar IV calls will fail at HeyGen until the placeholders are replaced — that's expected.

## Out of scope

- No multi-photo gallery, no per-language voice mapping, no headshot management UI on the projects list.
- No edits to the existing Video Agents path beyond the branch.
- No video player UI changes.
