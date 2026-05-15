## Goal

When a project has a completed video (`status === "ready"`), it should not be editable. Users can still open it to view its details, but every input is read-only and Save is hidden.

## Changes

### 1. `src/routes/projects.tsx` — Edit button becomes "View"

For rows where `p.status === "ready"`:
- Swap the `Pencil` icon for an `Eye` icon (lucide-react), title="View".
- Keep the same link target (`/new?edit=p.id`) so the same page is reused in read-only mode.

Other statuses keep the existing Pencil/Edit behavior unchanged.

### 2. `src/routes/new.tsx` — Read-only mode when project is ready

- After `getProject` returns, store the project's `status` in local state.
- Derive `const readOnly = isEdit && projectStatus === "ready";`.
- Update page heading/subtitle when `readOnly` ("View Project" / "This project's video is complete and locked from editing.").
- Pass `disabled={readOnly}` (or `readOnly` for `Input`/`Textarea`) to all form fields: product URL, summary, persona Select, languages ToggleGroup/Select, voice Select + custom voice input, length input, headshot Tabs + URL/file inputs.
- Hide the Submit button when `readOnly`; keep the Cancel button but relabel to "Back to projects".
- Skip the headshot upload path entirely in `handleSubmit` when `readOnly` (defensive — submission shouldn't be reachable).

### Technical notes

- `status` is already returned by `getProject` (selected in `projects.functions.ts`), so no backend change.
- The server-side `updateProject` already keeps existing values intact; we are only locking the UI. No migration needed.
- A defensive guard in `handleSubmit` (`if (readOnly) return;`) prevents accidental submits.

No changes to RLS, schema, or server functions.
