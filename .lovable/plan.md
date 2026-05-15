## What's actually happening

When you click **Review script & render** on the Projects page, it *is* doing something — it navigates to `/projects/<id>/script`. But two things make it feel broken:

1. The button is a plain link with no pressed/loading state, so the click feels ignored while the next page is fetching.
2. On the script page itself, when a script needs to be generated (or regenerated) the textarea just shows a faint "Generating script…" placeholder. There's no spinner, no disabled-but-styled "working" button, and the **Looks good — render video** button is silently disabled during generation — so a user who clicks it gets nothing.
3. When you do click **Looks good — render video**, the only feedback is the button text changing to "Starting render…". On a slow render-start that's easy to miss, and the gradient styling masks the disabled state.

The script *does* appear — it's the big editable textarea in the middle of the page (under "Review the script"). It's just not obvious that it's the script while it's blank/loading.

## Fix (UI/UX only — no logic changes)

### 1. Projects page — `Review script & render` button
- Replace the plain `<Link>`-as-button with a click-handled button that:
  - Tracks a per-row `navigatingId` state.
  - On click, sets `navigatingId = p.id`, then `navigate({ to: "/projects/$projectId/script", params })`.
  - While `navigatingId === p.id`: show a spinner + label "Opening script…", apply `variant="default"` (filled, not secondary) so the color change is obvious, and disable the button.
- Same treatment for the `Retry — review script` variant.

### 2. Script page (`projects.$projectId.script.tsx`) — make the script obvious
- Add a clear section heading **Generated script** directly above the textarea so it's named, not just a blank field.
- While `generating === true`:
  - Overlay a centered spinner + "Writing your script… this takes 10–20 seconds" message on top of the textarea (textarea stays visible but greyed).
  - Show a small skeleton/pulse on the word-count line.
- When generation finishes, briefly flash a subtle success ring around the textarea (1s) so the user sees it just populated.
- Add an empty-state message inside the textarea container if generation fails (currently only a toast fires and the field is left blank).

### 3. `Looks good — render video` button — visible "working" state
- While `rendering === true`:
  - Swap to a distinct color (e.g. `variant="secondary"` with a pulsing ring, or drop the gradient and use solid `bg-muted text-muted-foreground`) so it visibly *changes*, not just changes label.
  - Show a spinner icon + "Starting render…".
  - Keep it disabled (already does).
- Same treatment for **Regenerate** while `generating === true` (spinner + greyed).

### 4. Small polish
- Disable **Regenerate** and **Render** while *either* `generating` or `rendering` is true (already done) — but also visually grey them, not just disabled-opacity.
- Add a `aria-busy` attribute on the textarea container during generation for screen readers.

## Files to change

- `src/routes/projects.tsx` — replace the Link-as-button with a stateful navigate button (~15 lines around line 272–280).
- `src/routes/projects.$projectId.script.tsx` — add overlay/spinner during generation, success flash, "Generated script" heading, restyled action buttons (~30 lines added).

## Out of scope

- Server-side script generation logic (already working — confirmed via worker logs that `getProject` returns 200 and a stored script loads).
- Any change to research, render, or HeyGen calls.

## How to verify

1. From `/projects`, click **Review script & render** — button should immediately turn into "Opening script…" with a spinner before the page transition completes.
2. On the script page with no stored script, you should see a spinner overlay + "Writing your script…" message until the textarea fills.
3. Click **Looks good — render video** — the button should visibly change color and show a spinner, not just change label.
4. Click **Regenerate** — same visible working state.