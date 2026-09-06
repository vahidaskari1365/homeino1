-- Inspiration comments — discussion under each pin.
-- Guest comments are posted through the server API (rate-limited); the RLS
-- insert policy is intentionally permissive so the anon-client fallback of
-- /api/inspirations/[slug]/comments also works when no service role is set.

create table if not exists public.inspiration_comments (
  id uuid primary key default gen_random_uuid(),
  pin_id text not null,
  parent_id uuid references public.inspiration_comments(id) on delete cascade,
  author_id uuid,
  author_name text not null check (char_length(trim(author_name)) between 2 and 40),
  author_type text not null default 'guest' check (author_type in ('user', 'guest')),
  body text not null check (char_length(trim(body)) between 2 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_inspiration_comments_pin
  on public.inspiration_comments (pin_id, created_at);

alter table public.inspiration_comments enable row level security;

drop policy if exists "inspiration_comments_select" on public.inspiration_comments;
create policy "inspiration_comments_select"
  on public.inspiration_comments for select
  using (true);

drop policy if exists "inspiration_comments_insert" on public.inspiration_comments;
create policy "inspiration_comments_insert"
  on public.inspiration_comments for insert
  with check (true);
