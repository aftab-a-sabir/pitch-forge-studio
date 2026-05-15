## Problem

The video player dialog renders the video offset inside a larger white card. The white border/offset comes from the `DialogContent` defaults — it ships with `grid gap-4 p-6` plus a `bg-background` panel, and our wrapper adds `p-4`. The result: the video sits inside a padded white panel that's bigger than the video itself.

## Fix

In `src/routes/projects.tsx`, tighten the `DialogContent` so the video IS the dialog (no surrounding white space), keeping the rounded corners:

- Replace `className="p-4 w-fit max-w-[min(90vw,72rem)]"` with `className="p-0 gap-0 border-0 bg-transparent shadow-none w-fit max-w-[min(90vw,72rem)] overflow-hidden"`.
  - `p-0 gap-0` removes the inner padding/grid gap that creates the white margin.
  - `bg-transparent border-0 shadow-none` drops the white panel chrome so only the video shows.
  - `overflow-hidden` keeps the existing rounded corners clean.
- Keep the inner sizing wrapper and `<video>` exactly as they are (aspect logic, `rounded-md`, `object-contain`, `bg-black`). The video itself becomes the visible surface, perfectly centered by the dialog's existing centering transform.
- Keep the `sr-only` `DialogTitle` for accessibility.

No changes to sizing math, project list, analytics, or anywhere else.
