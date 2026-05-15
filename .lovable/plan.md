## Diagnosis

The script page is now reaching the server function, but the server function is returning `LOVABLE_API_KEY is not configured`. The key exists in project secrets, but the local/server runtime visible to this request is not exposing it as `process.env.LOVABLE_API_KEY`, so the app currently fails before it can call the AI gateway.

There is also still evidence of route-tree churn from the earlier rename, so I will avoid touching the generated route tree directly and make the route file convention stable.

## Plan

1. **Add a safe AI gateway key resolver**
   - Create a small server-side helper that reads `LOVABLE_API_KEY` inside the server function execution path.
   - Include a fallback for runtime environments where secrets are exposed through the framework/runtime context rather than plain `process.env`.
   - Keep the key server-only and never expose it to the browser.

2. **Use the resolver in both AI server functions**
   - Update `generateScript` and `researchProduct` to use the shared resolver instead of directly reading `process.env.LOVABLE_API_KEY`.
   - Preserve the current authenticated access checks and database writes.
   - Improve the user-facing error so the textarea does not show a raw internal env-var message.

3. **Stabilize the script route**
   - Confirm the script route file uses the intended non-nested TanStack path convention.
   - Remove any manual dependency on `src/routeTree.gen.ts`; let the dev server regenerate it.
   - Restart the dev server after changes so stale generated imports are cleared.

4. **Verify the actual failing path**
   - Reload or invoke the same `/projects/:projectId/script` flow.
   - Confirm the request no longer returns `LOVABLE_API_KEY is not configured` and the generated script populates the textarea, or returns a clear retryable AI gateway error if the upstream model call fails.