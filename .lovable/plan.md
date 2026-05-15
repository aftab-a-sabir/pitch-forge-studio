## Plan

Update the `/projects` video playback modal so every landscape video uses the same presentation-style frame as the Apple video, instead of sizing itself differently per generated file.

### What will change

1. **Use a consistent 16:9 presentation frame for landscape playback**
   - Treat landscape videos as presentation videos.
   - Use a stable responsive 16:9 container instead of letting each file’s metadata dictate a different visible size.
   - Keep `object-contain` so the actual video is never cropped.

2. **Make the modal viewport-aware**
   - Size the player from the available viewport using both width and height caps.
   - On desktop/tablet, the player will fit like a presentation slide.
   - On smaller screens, it will shrink proportionally so controls and close button remain usable.

3. **Keep fallback handling for non-landscape videos**
   - If a future video is truly portrait or square, it can still use its natural aspect ratio and stay within the viewport.
   - The current ice-cream, Roomba, and Apple landscape videos will align to the same presentation view.

### Technical details

- In `src/routes/projects.tsx`, replace the current wrapper sizing (`max-h-[80vh] max-w-[90vw]` plus metadata-driven width) with a deterministic responsive frame.
- Detect the natural aspect ratio on `onLoadedMetadata`, but normalize landscape videos to `16 / 9` for display.
- Give the wrapper explicit viewport-relative dimensions, for example:
  - `width: min(90vw, calc(80vh * 16 / 9), 72rem)` for landscape presentation mode
  - `aspect-ratio: 16 / 9`
- Keep the video element at `h-full w-full object-contain bg-black`.
- Keep existing analytics and dialog open/close behavior unchanged.