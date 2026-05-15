# Fix: Avatar IV script just spells out the URL

## Root cause

`generateAvatarIVScript` in `src/lib/heygen.functions.ts` passes only the raw URL to the LLM via `buildAvatarIVScriptPrompt`. The model has no way to know what's at that URL, so it falls back to literally reading the URL aloud. We also already capture an optional `product_summary` field on the project but never feed it into the prompt.

## What to change

### 1. Use `product_summary` in the prompt
- Select `product_summary` in the project query inside `generateProjectVideo` (Avatar IV branch).
- Pass it through to `generateAvatarIVScript`.

### 2. Fetch lightweight page context when summary is missing or thin
- Add `fetchProductContext(url)` helper in `src/lib/heygen.functions.ts` (server-only).
- `fetch(url)` with a 5s `AbortSignal.timeout`, `User-Agent` header, only accept `text/html`, cap body at ~200 KB.
- Regex-extract: `<title>`, `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">`, first `<h1>`, first 2 `<h2>`. Strip tags, collapse whitespace, truncate to ~1500 chars total.
- Wrap in try/catch — failures return `null` and we degrade gracefully (still better than today's URL-only behavior).

### 3. Update `buildAvatarIVScriptPrompt` (`src/lib/heygen-prompt.ts`)
- Add optional `product_summary?: string` and `page_context?: string` fields to `HeygenPromptInput`.
- When either is present, include a "Product context:" block in the prompt and instruct the model to base concrete benefits on that context — never to read the URL aloud, never to invent unverified claims.
- Keep the existing length / persona / language guidance.

### 4. Update fallback script (`buildFallbackAvatarIVScript`)
- Prefer the first 1–2 sentences of `product_summary` (or scraped description) over the bare URL when constructing the fallback.

### 5. No DB / UI changes required
- `product_summary` is already captured in `src/routes/new.tsx`. We may add a one-line hint under the textarea ("Used to write your video script — the more specific, the better.") to nudge users to fill it in. Optional.

## Out of scope
- Full HTML→Markdown extraction or headless browser scraping.
- Caching scraped context on the project row (can add later if latency becomes an issue).
- Re-running script generation for already-failed/old projects automatically — user can edit + regenerate.

## Verification
- Edit an existing project, ensure summary is filled (or rely on scrape), regenerate.
- Check server logs: `heygen.avatar_iv` log line; confirm no errors.
- Confirm new HeyGen video script reads as a real sales pitch, not the URL.
