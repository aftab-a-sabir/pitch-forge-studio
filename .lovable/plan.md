## Goal

On the New Project screen, simplify the user-facing flow so only the default automatic script and video generation is available. Move Voice and Presenter Headshot to the bottom, group them in a visually distinct "Coming Soon" container, and disable their controls.

## Changes — `src/routes/new.tsx` only

### 1. Reorder fields

New top-to-bottom order inside the form:
1. Product URL
2. Product summary (optional)
3. Target persona
4. Target language(s)
5. Video length (seconds)
6. **Coming Soon group** (Voice + Presenter Headshot, see below)
7. Submit / Cancel buttons

Voice and Presenter Headshot blocks are removed from their current positions and re-rendered together at the bottom.

### 2. "Coming Soon" group container

Wrap Voice and Presenter Headshot in a single container styled as a soft grey card to visually separate it from the active form:

```tsx
<div className="rounded-lg border border-dashed bg-muted/40 p-4 space-y-6 relative">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold text-muted-foreground">Advanced options</h3>
    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      Coming soon
    </span>
  </div>
  {/* Voice block */}
  {/* Presenter headshot block */}
</div>
```

Inside this container, every interactive control gets `disabled` (and Tabs gets `onValueChange={undefined}`) regardless of `readOnly`. Helper text under each is replaced with "Coming soon — the default voice and avatar will be used."

### 3. Disable submission of advanced fields

In `handleSubmit`, force the "default automatic" path by ignoring any prior state from those controls:
- Skip `resolveHeadshotUrl()` entirely; pass `headshot_url: undefined`.
- Skip the voice resolution branch; pass `voice_id: undefined`.
- Remove the `if (parsed.data.headshot_url)` branch that routes to `/projects/$projectId/script`. After create, always `navigate({ to: "/projects" })`.

This guarantees only the default automatic script + video generation runs, matching what the disabled UI advertises.

### 4. Keep read-only mode intact

The existing `readOnly` (completed video) behavior continues to work — the Coming Soon controls are already disabled in both modes; other fields keep their existing `disabled={readOnly}` props.

## Out of scope

- No backend / server function changes. `createProject` / `updateProject` still accept `voice_id` and `headshot_url`; we simply stop sending them from the UI.
- No changes to `projects.tsx`, the script preview route, or HeyGen config.
- No design-system token changes; reuse existing `bg-muted`, `border-dashed`, `text-muted-foreground`.
