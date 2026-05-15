## New Project form: required fields + typed server fn submission

### Form fields (rewrite `src/routes/new.tsx`)

| Field | Control | Notes |
|---|---|---|
| `product_url` | `<Input type="url">` | required |
| `product_summary` | `<Textarea>` | optional fallback if URL parsing fails |
| `target_persona` | shadcn `<Select>` | options: Founder, CFO, HR Manager, IT Lead |
| `target_language` | shadcn `<Select>` (single) | default & only visible option: **English**; stored as array `["English"]` for forward compatibility |
| `video_length_seconds` | `<Input type="number">` | default `45`, min `15`, max `120` |

Client-side validation with zod; inline error messages.

### Language configuration — built for easy expansion

Single source of truth in `src/lib/languages.ts`:

```ts
export type Language = "English" | "Spanish" | "French" | "German";

// All languages the backend understands. Add new ones here first.
export const ALL_LANGUAGES: Language[] = ["English", "Spanish", "French", "German"];

// Languages the UI currently exposes. Today: English only.
// To expose more later, add them to this array.
export const SELECTABLE_LANGUAGES: Language[] = ["English"];

export const DEFAULT_LANGUAGE: Language = "English";

// Flip to true when ready for multi-select; the form re-renders as
// a ToggleGroup automatically.
export const MULTI_SELECT_LANGUAGES = false;
```

The form reads these constants:
- `MULTI_SELECT_LANGUAGES === false` → render a `<Select>` whose options are `SELECTABLE_LANGUAGES`, default `DEFAULT_LANGUAGE`. With one entry, the control is effectively locked to English but the markup is already correct.
- `MULTI_SELECT_LANGUAGES === true` → render a `ToggleGroup type="multiple"` over `SELECTABLE_LANGUAGES`, ≥1 required.

In both cases the submitted value is `target_languages: Language[]` (today `["English"]`), so the database column, server-fn input schema, and downstream code never change when languages are added or multi-select is enabled.

To pare back to English-only later: leave `SELECTABLE_LANGUAGES = ["English"]` (or remove other entries). To add Spanish to the dropdown: append `"Spanish"` to `SELECTABLE_LANGUAGES`. To enable multi-select: set `MULTI_SELECT_LANGUAGES = true`.

### Backend — `createServerFn` (TanStack typed RPC)

Per TanStack Start best practice on this stack, no raw `/api/createProject` route. Instead:

- `src/lib/projects.functions.ts` exports `createProject = createServerFn({ method: "POST" })`
  - `.middleware([requireSupabaseAuth])` — auth, no CORS, no manual token plumbing
  - `.inputValidator(z.object({ product_url, product_summary?, target_persona (enum), target_languages: z.array(z.enum(ALL_LANGUAGES)).min(1), video_length_seconds (int 15–120, default 45) }).parse)` — accepts any language in `ALL_LANGUAGES` so backend doesn't need a redeploy when the UI exposes more
  - `.handler` — uses `context.supabase` (RLS-scoped) to `INSERT` into `public.projects`, returns `{ id }`

- `src/routes/new.tsx` calls it via `useServerFn(createProject)` and navigates to `/projects` on success; toast on error.

- Confirm `src/start.ts` registers `attachSupabaseAuth` in `functionMiddleware`.

### Database (migration)

```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_url text not null,
  product_summary text,
  target_persona text not null,
  target_languages text[] not null default '{English}',
  video_length_seconds int not null default 45,
  status text not null default 'Generating',
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "own projects read"   on public.projects for select using (auth.uid() = user_id);
create policy "own projects insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "own projects delete" on public.projects for delete using (auth.uid() = user_id);
```

### Dashboard

Update `src/routes/projects.tsx` to fetch real rows from `public.projects` (RLS-scoped) instead of `localStorage`. Columns: product URL, persona, languages, length, status, created.

### Files touched

- `src/lib/languages.ts` (new) — language config
- `src/lib/projects.functions.ts` (new) — `createProject` server fn
- `src/routes/new.tsx` — rewritten form, calls server fn
- `src/routes/projects.tsx` — read from `projects` table
- `src/start.ts` — verify `attachSupabaseAuth` in `functionMiddleware`
- new migration for `public.projects`
