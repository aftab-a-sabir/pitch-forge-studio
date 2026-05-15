## What I found

The app is hanging before it even reaches script generation. The page stays on the top-level `Loading…` state because `useRequireAuth()` never finishes resolving auth in this route session. In the browser trace I saw only:

- auth/profile requests
- a `listProjects` server call
- no `getProject` call
- no `generateScript` call
- no AI/script logs

So the current spinner is not primarily an LLM quality problem. It is an app flow/auth/loading-state problem, with a second risk that script generation can still take too long once it actually starts.

## Answer on alternate LLMs

An alternate LLM could help script quality and maybe latency, but it will not fix this specific “Opening script / still spinning” failure. The app currently gets stuck before the script generation request is made. A faster model only helps after the route successfully loads and calls `generateScript`.

## Recommended approach

### 1. Fix the script page loading gate
- Make the script page stop depending on an auth hook that can hang indefinitely.
- Load auth/project state with explicit success, error, and timeout states.
- If auth is missing, redirect to `/auth`; if project load fails, show a retryable error instead of permanent `Loading…`.

### 2. Make script generation a real background-style step
- Split the page state into clear phases:
  - `Loading project`
  - `Researching product`
  - `Writing script`
  - `Ready to review`
  - `Failed — retry`
- Add a client-side timeout around the script generation call so users never stare at an infinite spinner.
- If the request times out or fails, show a clear message and a `Try again` button.

### 3. Use a faster default model for scripts
- Switch script/research generation from the current model to Lovable AI’s faster default model.
- Keep a fallback model option only if the first model fails or returns weak/empty output.
- This improves speed/reliability, but is secondary to fixing the hanging page state.

### 4. Keep video rendering separate
- Pressing `Looks good — render video` should still return quickly after the video provider accepts the job.
- The Projects page can continue polling/checking render status.
- No-photo Video Agents path remains unchanged.

## Technical changes

- `src/routes/projects.$projectId.script.tsx`
  - Replace the current single `loading/checking/generating` interaction with explicit phase/error state.
  - Ensure `loading` is always cleared on auth/project failures.
  - Add retry buttons for project load and script generation failures.
  - Add timeout handling so long script generation does not spin forever.

- `src/lib/script.functions.ts`
  - Use a faster model for script generation.
  - Add stronger logging around start/success/failure so we can see exactly where it stalls.

- `src/lib/research.functions.ts`
  - Use a faster model for product-brief extraction.
  - Add start/success/failure logs and keep the existing fetch timeout.

## Verification

1. Open `/projects/:id/script` directly.
2. Confirm it leaves `Loading…` and either shows the script editor or a retryable error.
3. Confirm the network trace includes `getProject`, then `generateScript` only when needed.
4. Confirm script generation either completes or fails with a visible retry button, never an infinite spinner.
5. Confirm `Looks good — render video` still starts render and returns to Projects.