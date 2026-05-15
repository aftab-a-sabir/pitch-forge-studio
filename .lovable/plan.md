## PostHog frontend integration

Add PostHog (browser SDK only) and emit three events tied to the existing flows on `/projects`. No backend tracking — keeps secrets out and avoids server cold-start cost.

### 1. Secret + config

- Add a build-time env var `VITE_POSTHOG_KEY` (PostHog **project API key** — this is a publishable client key, safe in the bundle) and optional `VITE_POSTHOG_HOST` (default `https://us.i.posthog.com`).
- Request the key via `add_secret` so it lands in the project env. Document that only the project key (`phc_…`) goes here — never the personal API key.

### 2. Install + initialize

- `bun add posthog-js`.
- New file `src/lib/analytics.ts`:
  - Exports `initAnalytics()`, `track(event, props)`, `identify(userId, props)`, `resetAnalytics()`.
  - `initAnalytics()` no-ops when `VITE_POSTHOG_KEY` is missing or when running on the server (`typeof window === "undefined"`), so SSR and local dev without a key stay clean.
  - Config: `capture_pageview: true`, `capture_pageleave: true`, `persistence: "localStorage+cookie"`, `autocapture: false` (we only want the explicit events; reduces noise + PII surface), `disable_session_recording: true`.
- Call `initAnalytics()` once inside `RootComponent` in `src/routes/__root.tsx` via a `useEffect`.

### 3. Identify / reset on auth changes

- In `__root.tsx` (or a small `useAnalyticsIdentity` hook), subscribe to `supabase.auth.onAuthStateChange`:
  - On `SIGNED_IN` / initial session: `identify(user.id, { email: user.email })`.
  - On `SIGNED_OUT`: `resetAnalytics()`.
- Using the Supabase user id (UUID) as the distinct id keeps events tied to the user without leaking any extra PII beyond email (which PostHog already expects for `$email`).

### 4. The three events

All fired from the browser in `src/routes/projects.tsx` / `src/routes/new.tsx`. Property names kept consistent and minimal — no URLs, no free-text summaries.

| Event | Where | Properties |
|---|---|---|
| `video_generation_started` | `handleGenerate` after `generateVideo(...)` resolves successfully (also covers /new flow if it auto-generates) | `project_id`, `persona`, `languages` (array), `video_length_seconds` |
| `video_generation_completed` | `handleCheck` when the returned `res.status === "ready"` and the previous local status was not already `ready` (guard against double-fire on repeated polls) | `project_id`, `persona`, `languages`, `video_length_seconds` |
| `video_played` | `<video onPlay>` handler inside the Dialog (fires once per open via a ref flag) | `project_id`, `persona`, `languages` |

Persona/language come from the `StoredProject` already in component state — no extra fetch.

### 5. Security & safety

- Only the **publishable** PostHog project key ships to the client. Never expose the personal API key; never call PostHog from server functions with admin credentials.
- `autocapture: false` and `disable_session_recording: true` prevent accidental capture of form values, product URLs, or summaries.
- No product URL, product summary, or HeyGen session/video ids are sent as event properties — only the project UUID + the persona/language metadata the user explicitly chose.
- `initAnalytics()` is a hard no-op on the server and when the key is unset, so SSR and unconfigured environments cannot accidentally send data.
- Add `posthog-js` as a regular dep (it's tree-shaken into the client bundle only; `analytics.ts` is imported from client components, never from `*.server.ts` / server fns).

### 6. Verification

1. Add the secret, deploy, open `/projects`.
2. Click **Generate video** → confirm `video_generation_started` appears in PostHog Live Events with `persona` and `languages`.
3. Poll **Check for Video** until status flips to `ready` → confirm `video_generation_completed`.
4. Click **Play Video** → confirm `video_played` fires once.
5. Confirm the `distinct_id` matches the Supabase user id and `$email` is set.

### Files touched

- new: `src/lib/analytics.ts`
- edited: `src/routes/__root.tsx` (init + identify), `src/routes/projects.tsx` (three event calls + onPlay handler)
- `package.json` (+ `posthog-js`)
- secret: `VITE_POSTHOG_KEY` (and optional `VITE_POSTHOG_HOST`)
