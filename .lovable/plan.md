## Goal
Remove the product URL line shown at the top of the video player dialog, while keeping the dialog accessible.

## Change
In `src/routes/projects.tsx` (around lines 267–269), the `DialogHeader` currently renders the product URL as the visible `DialogTitle`. Replace it with a screen-reader-only title so the URL is no longer visible in the player UI.

- Drop the `<DialogHeader>` wrapper.
- Keep a `<DialogTitle>` for accessibility (Radix requires one), but render it inside a `sr-only` span so it is hidden visually. Use a generic label like "Video player" rather than the URL.
- No other dialog content, sizing, or video logic changes.

## Why keep a hidden title
Radix Dialog logs an a11y warning (and screen readers lose context) without a `DialogTitle`. `sr-only` keeps the player visually clean while preserving accessibility.

## Out of scope
No changes to the project list, the URL link in the cards, video sizing, or analytics.
