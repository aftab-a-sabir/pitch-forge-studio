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
create policy "own projects read"   on public.projects for select to authenticated using (auth.uid() = user_id);
create policy "own projects insert" on public.projects for insert to authenticated with check (auth.uid() = user_id);
create policy "own projects delete" on public.projects for delete to authenticated using (auth.uid() = user_id);
create index projects_user_id_created_at_idx on public.projects (user_id, created_at desc);