## Plan

1. **Fix the actual routing bug**
   - `src/routes/projects.$projectId.script.tsx` is currently being registered as a child of `/projects`.
   - But `src/routes/projects.tsx` renders only the dashboard and does **not** render an `<Outlet />`, so the script page can match in the router while the dashboard stays on screen.
   - I’ll move the script route out of the `/projects` parent relationship by renaming it to the flat TanStack path convention for `/projects/:projectId/script`, so it renders as its own page instead of inside the dashboard.

2. **Stop the dashboard button from spinning forever**
   - Change the dashboard action from imperative `navigate()` plus persistent `navigatingId` state to a normal TanStack `<Link>` inside the button.
   - That removes the stale “Opening script…” state when route rendering fails or the user remains on the dashboard.
   - Keep clear click feedback, but make it temporary/fail-safe rather than permanent.

3. **Keep the script preview page behavior already added**
   - Preserve the phase states on the script page: loading project, writing script, ready, retryable error.
   - The generated script will continue to appear in the textarea under **Generated script** once generation completes.

4. **Verify the route registration**
   - Confirm the route file convention is correct and that `/projects/:projectId/script` no longer depends on `projects.tsx` rendering an outlet.
   - Check current dev-server logs for route/build errors after the route rename.

## Technical notes

- This is not primarily an LLM issue. The current symptom is navigation/UI state: the script route is nested under `/projects`, but the `/projects` route component has no `<Outlet />`, so the child page cannot visibly render.
- I will not edit `src/routeTree.gen.ts`; it is generated automatically by TanStack Router.