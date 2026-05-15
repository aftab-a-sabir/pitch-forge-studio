# Fix: Avatar IV video too short and lower quality than Video Agents

## Root cause

Two HeyGen endpoints, two very different behaviors:

| Path | Endpoint | Script source | Duration driven by |
|---|---|---|---|
| No photo | `/v3/video-agents` | HeyGen writes it internally from our prompt | HeyGen targets `video_length_seconds` itself |
| Photo + voice | `/v2/videos` (Avatar IV) | **Our LLM script, read verbatim** | **Length of our script × voice cadence** |

Today the Avatar IV script:
- Uses `google/gemini-2.5-flash` (fastest/cheapest, weakest at long-form copy).
- Targets `seconds × 2.5` words with no floor and no retry — Gemini Flash routinely returns ~half that.
- Has no length verification, so a 60s project can ship a ~25s video.

Video Agents looks "higher quality" mostly because (a) its script is longer and better-written, and (b) HeyGen's stock avatar pipeline is more polished than Avatar IV. We can't fix (b) — that's HeyGen — but (a) is fully in our control.

## What to change

All changes in `src/lib/heygen.functions.ts` and `src/lib/heygen-prompt.ts`. No DB or UI changes.

### 1. Upgrade the script model
- Switch `generateAvatarIVScript` from `google/gemini-2.5-flash` to `openai/gpt-5-mini` (much stronger long-form copy, still fast/cheap). Keep Gemini Flash as a fallback only if gpt-5-mini errors.

### 2. Make length a hard target, not a hint
- Bump cadence assumption from 2.5 → **2.7 wps** (Avatar IV voices are slightly faster than the old default).
- Compute `targetWords` and a `minWords = Math.round(targetWords * 0.9)`.
- Pass both into the prompt: explicit "Write **between {min} and {target+10%} words**. Do not stop early."
- After generation, count words. If `< minWords`, run **one expansion pass**: send the draft back with "Expand to at least {minWords} words by deepening the benefits and call to action. Keep the same tone, no filler, no repetition." If still short after retry, accept it (don't loop).

### 3. Strengthen the prompt itself
- Tighten `buildAvatarIVScriptPrompt` to a clear 4-beat structure: (1) hook tied to the persona's pain, (2) what the product is, (3) 2–3 concrete benefits grounded in `product_summary` / `page_context`, (4) one-line CTA.
- Reiterate the no-URL / no-stage-directions rules at the top, where models actually obey them.
- Emit the word budget explicitly inside the prompt body (LLMs hit length targets much more reliably when the number appears inline).

### 4. Avatar IV render settings
- Bump `expressiveness` from `"medium"` to `"high"` for more dynamic delivery.
- Keep `1080p` / `16:9`.

### 5. Logging
- After generation, `console.log("heygen.script", { project_id, words, target: targetWords, retried })` so we can verify in production whether the length floor is being hit.

## Out of scope

- Switching the no-photo path away from Video Agents.
- Caching scraped page context on the project row.
- Letting the user preview/edit the generated script before render (worth doing later, not now).

## Verification

1. Regenerate the same project that produced the bad video.
2. Check server logs: `heygen.script` line should show `words` within ~10% of `target` (e.g. 60s → ~155–180 words).
3. Confirm rendered video duration is close to the requested `video_length_seconds`.
4. Confirm the spoken content is a proper sales pitch (hook → benefits → CTA), not a recited URL or a 15-second blurb.
