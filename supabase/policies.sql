-- ============================================================================
-- Translation Audio Manager — access configuration
--
-- ⚠️ READ THIS FIRST
-- This app has no login screen. The browser talks to Supabase with the anon
-- key only. That means whatever the anon key is allowed to do, ANY visitor of
-- your deployed URL can do — including deleting every project.
--
-- Section A is the DEVELOPMENT setup described in the README (RLS off, public
-- bucket). Use it on localhost or behind a private URL only.
--
-- Section B is a starting point for a PRODUCTION setup with Supabase Auth.
-- ============================================================================


-- ============================================================================
-- SECTION A — development setup (no auth)
-- ============================================================================

alter table public.projects disable row level security;
alter table public.translation_rows disable row level security;

-- Storage: create the bucket as PUBLIC.
-- Easiest path: Dashboard → Storage → New bucket → name `translation-audio`,
-- toggle "Public bucket" on. The SQL below does the same thing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'translation-audio',
  'translation-audio',
  true,
  20971520,                        -- 20MB, matching the client-side limit
  array['audio/mpeg', 'audio/mp3']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects always has RLS enabled and cannot be turned off, so the anon
-- role needs explicit policies to upload and delete.
drop policy if exists "dev: anon can read translation audio" on storage.objects;
create policy "dev: anon can read translation audio"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'translation-audio');

drop policy if exists "dev: anon can upload translation audio" on storage.objects;
create policy "dev: anon can upload translation audio"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'translation-audio');

drop policy if exists "dev: anon can update translation audio" on storage.objects;
create policy "dev: anon can update translation audio"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'translation-audio')
with check (bucket_id = 'translation-audio');

drop policy if exists "dev: anon can delete translation audio" on storage.objects;
create policy "dev: anon can delete translation audio"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'translation-audio');


-- ============================================================================
-- SECTION B — production setup (Supabase Auth + RLS)
--
-- Do NOT run this until you have added authentication to the app.
-- Everything below is commented out on purpose.
--
-- Steps:
--   1. Add `owner_id uuid references auth.users(id)` to public.projects.
--   2. Add sign-in to the app (@supabase/ssr + middleware) and switch
--      lib/supabase/client.ts to `persistSession: true`.
--   3. Make the bucket private and swap `getAudioUrl()` for
--      `createSignedAudioUrl()` in lib/supabase/storage.ts (already written).
--   4. Run this section.
-- ============================================================================

-- alter table public.projects add column if not exists owner_id uuid references auth.users(id) on delete cascade;
--
-- alter table public.projects enable row level security;
-- alter table public.translation_rows enable row level security;
--
-- create policy "owners manage their projects"
-- on public.projects for all
-- to authenticated
-- using (owner_id = auth.uid())
-- with check (owner_id = auth.uid());
--
-- create policy "owners manage their rows"
-- on public.translation_rows for all
-- to authenticated
-- using (
--   exists (
--     select 1 from public.projects p
--     where p.id = translation_rows.project_id and p.owner_id = auth.uid()
--   )
-- )
-- with check (
--   exists (
--     select 1 from public.projects p
--     where p.id = translation_rows.project_id and p.owner_id = auth.uid()
--   )
-- );
--
-- update storage.buckets set public = false where id = 'translation-audio';
--
-- drop policy if exists "dev: anon can read translation audio" on storage.objects;
-- drop policy if exists "dev: anon can upload translation audio" on storage.objects;
-- drop policy if exists "dev: anon can update translation audio" on storage.objects;
-- drop policy if exists "dev: anon can delete translation audio" on storage.objects;
--
-- create policy "authenticated users manage translation audio"
-- on storage.objects for all
-- to authenticated
-- using (bucket_id = 'translation-audio')
-- with check (bucket_id = 'translation-audio');
