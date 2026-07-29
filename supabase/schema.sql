-- ============================================================================
-- Translation Audio Manager — schema
-- Run this in the Supabase dashboard: SQL Editor → New query → Run.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.translation_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  original text not null default '',
  japanese text not null default '',
  reading text not null default '',
  audio_path text,
  audio_file_name text,
  audio_size integer,
  audio_duration numeric,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (filtering by project, ordering by position)
-- ---------------------------------------------------------------------------
create index if not exists translation_rows_project_id_idx
  on public.translation_rows(project_id);

create index if not exists translation_rows_position_idx
  on public.translation_rows(project_id, position);

-- ---------------------------------------------------------------------------
-- updated_at auto-update
-- ---------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_projects_updated_at on public.projects;
create trigger update_projects_updated_at
before update on public.projects
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_translation_rows_updated_at on public.translation_rows;
create trigger update_translation_rows_updated_at
before update on public.translation_rows
for each row
execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- OPTIONAL: transactional helpers (RPC)
--
-- The app works without these — it uses a single batched upsert for reordering
-- and a single batched insert for Bulk Import, which PostgREST already runs in
-- one statement (and therefore one transaction).
--
-- Install these if you want an explicit, named transaction boundary — for
-- example if you later add per-row validation or an audit log.
-- Switch `updateRowPositions` / `createTranslationRows` in
-- lib/supabase/translation-rows.ts to `supabase.rpc(...)` to use them.
-- ---------------------------------------------------------------------------

-- Reorder rows atomically. Payload: [{"id": "...", "position": 0}, ...]
create or replace function public.reorder_translation_rows(
  p_project_id uuid,
  p_positions jsonb
)
returns void
language plpgsql
as $$
begin
  update public.translation_rows as t
  set position = (item ->> 'position')::int
  from jsonb_array_elements(p_positions) as item
  where t.id = (item ->> 'id')::uuid
    and t.project_id = p_project_id;
end;
$$;

-- Insert many rows atomically, appending after the current max position.
-- Payload: [{"original": "...", "japanese": "...", "reading": "..."}, ...]
create or replace function public.bulk_insert_translation_rows(
  p_project_id uuid,
  p_rows jsonb
)
returns setof public.translation_rows
language plpgsql
as $$
declare
  v_start integer;
begin
  select coalesce(max(position), -1) + 1
  into v_start
  from public.translation_rows
  where project_id = p_project_id;

  return query
  insert into public.translation_rows (project_id, original, japanese, reading, position)
  select
    p_project_id,
    coalesce(item ->> 'original', ''),
    coalesce(item ->> 'japanese', ''),
    coalesce(item ->> 'reading', ''),
    v_start + (ordinality - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(item, ordinality)
  returning *;
end;
$$;
