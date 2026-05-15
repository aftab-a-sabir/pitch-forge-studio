## Goal

Turn the Projects page into a user dashboard with welcome text + signed-in identity, and add a splash of color (purple accent, à la the reference screenshot) to the dashboard heading and the landing page CTA buttons. Keep the design minimalist.

## Changes

### 1. `src/routes/projects.tsx` — Projects Dashboard

- Fetch the current user via `supabase.auth.getUser()` once auth check passes, and load the matching `profiles` row to get `display_name`.
- Replace current header block with:
  - **H1**: "Welcome to your Projects Dashboard" — colored accent (purple gradient text, e.g. `bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent`).
  - **Subtext**: "You are signed in as `<display_name> (<email>)`" if a display name exists, otherwise "You are signed in as `<email>`".
- Keep the existing projects table below it; keep the "New Project" button but apply the new colored primary style.
- Add a Sign out button in the top nav (small, ghost-style) — minor UX nicety since this is now the dashboard.

### 2. `src/routes/index.tsx` — Landing CTA color

- Style the **Sign up** button with the purple accent (gradient or solid `bg-primary` with the new primary token).
- Keep **Sign in** as the outline secondary button.

### 3. `src/styles.css` — Color token

- Update `--primary` (and `--ring`) to a vibrant purple in oklch (matches the "AI Builders Hub" reference: roughly `oklch(0.55 0.25 295)`), with a complementary `--accent` for the gradient. Keep everything else neutral/minimal so the purple reads as the single splash of color.

## Technical notes

- Profile fetch: `supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()`. RLS already allows authenticated users to read profiles.
- No new routes, no new packages, no schema changes.
- `useRequireAuth` already redirects unauthenticated users — dashboard logic only runs once `checking` is false.

## Out of scope

- Sign-up flow that actually creates a `profiles` row (existing behavior unchanged — if no row exists, we just show the email).
- Any changes to `/new` or `/auth` pages.
