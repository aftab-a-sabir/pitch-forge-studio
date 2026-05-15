## Goal

Allow users to edit existing projects (especially after a generation error) and delete projects, with a safety warning when deleting one that has a successfully generated video.

## UX changes (`src/routes/projects.tsx`)

In the Actions column, add two icon buttons next to the existing Generate/Check/Play button on every row:

- **Edit** (pencil icon) — navigates to `/new?edit=<projectId>`. Available on every project regardless of status.
- **Delete** (trash icon) — opens an `AlertDialog`:
  - If `status === "ready"` (or `video_url` is set): warning text "This project has a generated video. Make sure you've downloaded it or no longer need it. This action cannot be undone."
  - Otherwise: simpler "Delete this project? This action cannot be undone."
  - Confirm button is destructive variant; cancel closes the dialog.
  - On confirm → call `deleteProject`, toast result, reload list.

No changes to the video player, table columns, or status logic.

## Edit flow (`src/routes/new.tsx`)

Reuse the existing New Project form for editing:

- Read `?edit=<projectId>` from the URL via `Route.useSearch()`.
- If present, on mount call a new `getProject({ projectId })` server fn and prefill all form fields: `product_url`, `product_summary`, `target_persona`, `target_languages`, `video_length_seconds`, `headshot_url` (and select the appropriate headshot tab: URL / Upload / Demo / None based on the stored value — Upload tab shows the existing URL as a preview with an option to replace).
- Page heading switches to "Edit Project" and submit button to "Save changes".
- Submit calls `updateProject` instead of `createProject`. On success, navigate back to `/projects`.
- If the project's `status` was `error`, after a successful save reset `status` to `pending`, clear `heygen_last_error`, `heygen_session_id`, `heygen_video_id`, and `video_url` so the user can re-trigger generation cleanly. Successful/processing projects keep their generation state — editing only updates the input fields.

## Server changes (`src/lib/projects.functions.ts`)

Add three new server functions, all using `requireSupabaseAuth` (RLS already restricts to owner):

1. **`getProject`** — input: `{ projectId: string }`. Selects the same columns as `listProjects` for a single row. Throws if not found.
2. **`updateProject`** — input: same shape as `createProjectSchema` plus `projectId`. Updates the row. If the existing row's `status === "error"`, also reset the generation fields described above. Returns `{ id }`.
3. **`deleteProject`** — input: `{ projectId: string }`. Deletes the row. Best-effort: also delete the headshot file from the `headshots` bucket if `headshot_url` points there (parse path, ignore failure). Returns `{ ok: true }`.

No database migration needed — existing RLS policies cover update/delete for the owner.

## Out of scope

- No bulk delete, no soft-delete/trash, no edit history.
- No changes to HeyGen logic, video player, or the headshots bucket policies.
- No edits to projects currently in `processing` status are blocked at the UI level (server allows it, but we don't add a special guard — the Edit button is always shown).
