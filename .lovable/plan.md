Same as previously approved plan, with one change:

- Drop `VITE_POSTHOG_HOST`. Hardcode `https://us.i.posthog.com` as the `api_host` inside `src/lib/analytics.ts`.
- Only secret to request: `VITE_POSTHOG_KEY` (the `phc_…` project key).

Everything else (events, identify/reset, autocapture off, files touched) stays as approved.