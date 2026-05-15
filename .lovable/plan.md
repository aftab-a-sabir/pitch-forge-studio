## HeyGen Video Agent Integration — Plan (revised v3)

Yes — three things change based on the spec you pasted:

1. **No `language` field** on `POST /v3/video-agents`. Language goes inside the `prompt` text only (our template already does this via `{language}`).
2. **Response is wrapped in `data`** and includes `session_id`, `status`, `video_id`, `created_at` — we should persist `video_id` too (that's what `GET /v3/videos/{video_id}` and the polling endpoint key off).
3. **There's a sibling endpoint** `GET /v3/video-agents/{session_id}/videos` that returns the rendered `video_url`, `thumbnail_url`, `duration`, and `status` — perfect for a "Refresh status" button later. I'll wire the storage now and add a stub helper, but won't build polling yet.

### End-to-end flow

```text
[/projects row]  →  click "Generate video"
       │
       ▼
generateProjectVideo(projectId)   ← server fn, requireSupabaseAuth
       │
       ├─ SELECT product_url, target_persona, target_languages,
       │     video_length_seconds FROM projects WHERE id = $1   (RLS)
       │
       ├─ buildHeygenPrompt({ ...row, language: target_languages[0] })
       │     → embeds language into the prompt string
       │
       ├─ POST https://api.heygen.com/v3/video-agents
       │     headers: x-api-key: $HEYGEN_API_KEY
       │     body:    { prompt, mode: "generate" }     ← NO language field
       │
       ├─ response = (await res.json()).data
       │     → { session_id, status, video_id, created_at }
       │
       ├─ UPDATE projects SET
       │     heygen_session_id = data.session_id,
       │     heygen_video_id   = data.video_id,
       │     status            = 'Generating'
       │
       └─ return { session_id, video_id, status }  →  toast + row updates
```

### 1. Secret
`add_secret HEYGEN_API_KEY`. Read inside `.handler()` only.

### 2. DB migration
Add three nullable columns to `public.projects`:
- `heygen_session_id text`
- `heygen_video_id text`
- `heygen_last_error text`

Add an UPDATE RLS policy scoped to `auth.uid() = user_id` (table currently has none).

### 3. Prompt template — `src/lib/heygen-prompt.ts`
```ts
export const HEYGEN_PROMPT_TEMPLATE =
  "Create a {video_length_seconds}-second sales video for the SaaS product at {product_url}, " +
  "speaking to a {target_persona}, in {language}, in a friendly yet confident tone. " +
  "Explain the main benefits clearly.";

export function buildHeygenPrompt(input: {
  video_length_seconds: number; product_url: string;
  target_persona: string; language: string;
}): string;
```

### 4. Helper server functions — `src/lib/heygen.functions.ts`

**`createHeygenSession`** (low-level)
- middleware: `requireSupabaseAuth`
- `inputValidator` (zod): `{ prompt: z.string().min(1).max(10000) }` — matches spec
- `.handler`:
  - `POST https://api.heygen.com/v3/video-agents` with header `x-api-key: process.env.HEYGEN_API_KEY` and body `{ prompt, mode: "generate" }`
  - On non-2xx: `console.error` status + body, throw with the upstream `error.message` if present
  - Parse JSON, **unwrap `.data`**, return `{ session_id, status, video_id, created_at }`

**`generateProjectVideo`** (UI entry point)
- middleware: `requireSupabaseAuth`
- `inputValidator`: `{ projectId: z.string().uuid() }`
- `.handler`:
  1. Load project row via RLS-scoped `context.supabase`
  2. `buildHeygenPrompt` using row + `target_languages[0]` (currently always `"English"`)
  3. Call `createHeygenSession({ prompt })`
  4. Success → update `heygen_session_id`, `heygen_video_id`, `status='Generating'`, clear `heygen_last_error`
  5. Failure → update `heygen_last_error`, `status='Failed'`, rethrow
  6. Return `{ session_id, video_id, status }`

**`listHeygenSessionVideos`** (stub, not wired to UI yet)
- `inputValidator`: `{ sessionId: z.string() }`
- `GET /v3/video-agents/{sessionId}/videos`, returns `{ videos: VideoDetail[] }`
- Reserved for the later "Refresh status" button — included now so the file is complete.

### 5. UI trigger on `/projects`
- Per-row "Generate video" button (shadcn `sm`), per-row loading state
- `useServerFn(generateProjectVideo)({ data: { projectId } })`
- `sonner` toast on success/error
- Refetch `listProjects` so updated `status` and IDs render
- Add a column showing truncated `heygen_video_id` (more useful than session id once we add polling)

### 6. Test page `/dev/heygen-test`
Two buttons:
- **Fixed prompt** → `createHeygenSession({ prompt: "Create a 30-second sales video … in English …" })` — proves HeyGen connectivity standalone
- **First project** → `generateProjectVideo({ projectId: <newest> })` — proves the projects-row → template → HeyGen wiring
Renders `session_id`, `video_id`, `status`, and pretty-printed raw response. Server-side `console.log("heygen.session", { session_id, video_id })`.

### 7. Verification
1. `add_secret HEYGEN_API_KEY`
2. Apply migration
3. `/dev/heygen-test` → both buttons return a `session_id` + `video_id`
4. `/projects` → Generate button updates the row
5. `stack_modern--server-function-logs search="heygen"` confirms IDs
6. `supabase--read_query` on `projects` confirms persisted IDs

### Files
- **new** `src/lib/heygen-prompt.ts`
- **new** `src/lib/heygen.functions.ts` (createHeygenSession, generateProjectVideo, listHeygenSessionVideos)
- **new** `src/routes/dev.heygen-test.tsx`
- **edit** `src/routes/projects.tsx` — Generate button, new column, toast
- **edit** `src/lib/projects.functions.ts` — include `heygen_session_id`, `heygen_video_id`, `heygen_last_error` in `listProjects` select
- **new migration** — 3 columns + UPDATE policy
- **secret** `HEYGEN_API_KEY`

No new npm deps. No change to `/new`.

### Out of scope (flagging)
- Polling `GET /v3/video-agents/{session_id}/videos` to fetch the final `video_url` (helper stubbed, no UI yet)
- Webhook receiver via `callback_url` (would be a `/api/public/webhooks/heygen` route — defer)
- Removing `/dev/heygen-test` (keep until the real button is confirmed working)
