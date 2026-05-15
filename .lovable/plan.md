## Problem

In `src/routes/projects.tsx`, the playback dialog renders:

```tsx
<DialogContent className="max-w-3xl">
  ...
  <video src={playing.video_url} controls autoPlay className="w-full rounded-md" />
</DialogContent>
```

`w-full` stretches the video to the full dialog width with no height cap. For a landscape clip (Apple) the result looks fine. For a portrait/vertical clip (the Superstore video, which HeyGen returns in 9:16 for product avatars), the same width forces the height to ~1.7× the width, so the player overflows the viewport and looks oversized.

There is also no responsiveness to device size — the dialog is always `max-w-3xl` regardless of whether the video is portrait, square, or landscape, and regardless of the user's screen.

## Fix

Make the player size driven by the video's natural aspect ratio and the device viewport, not by a fixed dialog width.

1. Read the video's intrinsic dimensions on `onLoadedMetadata` (`videoWidth` / `videoHeight`) and store the aspect ratio in component state.
2. Render the `<video>` inside a wrapper that:
   - Applies `aspect-ratio: <w>/<h>` once known (fallback `16/9` while loading).
   - Caps size with `max-h-[80vh]` and `max-w-[90vw]` so it always fits the viewport on phones, tablets, and desktops.
   - Uses `object-contain` and centers the element, so letterboxing handles any mismatch gracefully.
3. Make the `DialogContent` width adapt: drop the hard `max-w-3xl` and instead let the inner wrapper drive width, with a sensible `max-w-[min(90vw,72rem)]` ceiling. Add `p-4` so chrome doesn't dominate on mobile.
4. Keep all existing analytics (`video_played`) and dialog open/close behavior unchanged.

## Technical details

- New state: `const [aspect, setAspect] = useState<number | null>(null)` reset to `null` whenever `playing` changes.
- `onLoadedMetadata={(e) => { const v = e.currentTarget; setAspect(v.videoWidth / v.videoHeight); }}`.
- Wrapper style: `style={{ aspectRatio: aspect ?? 16/9 }}` plus Tailwind `max-h-[80vh] max-w-[90vw] mx-auto`.
- `<video>` becomes `className="h-full w-full rounded-md object-contain bg-black"`.
- Dialog: `<DialogContent className="p-4 max-w-[min(90vw,72rem)] w-fit">`.

## Out of scope

No backend, schema, or HeyGen prompt changes. Aspect ratio of the generated video itself isn't changed — only how the player displays it.
