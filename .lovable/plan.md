## Goal
Make the "Sign up" button on the landing page open the Auth page with the Sign Up tab preselected, while "Sign in" continues to open the Sign In tab.

## Approach
Use a URL search param (`?tab=signup` / `?tab=signin`) to communicate intent from the landing page to the Auth page.

## Changes

1. **`src/routes/index.tsx`**
   - Update the "Sign up" `<Link>` to include `search={{ tab: "signup" }}`.
   - Update the "Sign in" `<Link>` to include `search={{ tab: "signin" }}` (explicit, for clarity).

2. **`src/routes/auth.tsx`**
   - Add a `validateSearch` to the route to type `tab` as `"signin" | "signup"` (default `"signin"`).
   - Read the value via `Route.useSearch()` and use it as the initial value of the `tab` state (replacing the hardcoded `"signin"`).
   - Keep the existing `Tabs` `value`/`onValueChange` so the user can still switch tabs after landing.

## Notes
- No backend, auth, or styling changes.
- No new dependencies.