## Plan to resolve the script generation error

The issue is still the same: `generateScript` and `researchProduct` directly read `process.env.LOVABLE_API_KEY`, but this app runs server functions in a Worker-style runtime where runtime secrets may be provided through the request `env` binding instead of `process.env`.

### Changes

1. **Add a server-only runtime secret helper**
   - Create a small `src/lib/runtime-env.server.ts` helper.
   - It will safely resolve secrets from:
     - the Worker request context/env binding when available
     - `process.env` as a fallback for local/dev compatibility
   - It will never expose secret values to the browser.

2. **Update AI gateway calls**
   - Update `src/lib/script.functions.ts` and `src/lib/research.functions.ts` to use the runtime secret helper instead of `process.env.LOVABLE_API_KEY`.
   - Update the AI gateway request headers to the current Lovable AI pattern:
     - `Lovable-API-Key: <key>`
     - `X-Lovable-AIG-SDK: vercel-ai-sdk`
   - Keep all existing authentication and project ownership checks intact.

3. **Improve failure behavior**
   - Replace the raw internal error message with a user-facing message if the AI service is unavailable or not configured.
   - Preserve detailed logging server-side without logging secret values.

4. **Verify the real path**
   - Restart the dev server if needed so the Worker/runtime binding changes are picked up.
   - Re-check recent network/server-function output for `/projects/:projectId/script` to confirm it no longer returns `LOVABLE_API_KEY is not configured`.
   - If a new upstream AI error appears, surface that separately instead of treating it as the same secret-loading bug.

### Not included

- No database changes.
- No UI redesign.
- No changes to generated backend integration files.