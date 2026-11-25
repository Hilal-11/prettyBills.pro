-- PrettyBills: user profiles
-- One row per auth user, created automatically on sign-up (email or Google).
-- Run in Supabase → SQL Editor, or with `supabase db push`. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid        primary key references auth.users (id) on delete cascade,
  full_name        text        check (char_length(full_name) <= 120),
  avatar_url       text        check (char_length(avatar_url) <= 2048),
  marketing_opt_in boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'Public profile for each auth user. Rows are created by private.handle_new_user().';

-- ---------------------------------------------------------------------------
-- Privileges: least privilege. Signed-out visitors get nothing; signed-in
-- users can read and edit only these columns (never id or timestamps).
-- Rows are inserted by the trigger, so no one gets INSERT or DELETE.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, marketing_opt_in) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: each user sees and edits only their own row.
-- (select auth.uid()) is evaluated once per query, not once per row.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Functions live in a schema the API doesn't expose.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Creates the profile when a user signs up. SECURITY DEFINER because the
-- auth service inserts into auth.users as a role that can't write here.
-- Metadata is read defensively: a bad value must never block a sign-up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, marketing_opt_in)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 120), ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''), 2048), ''),
    coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', '') = 'true'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keeps updated_at honest on every edit.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.touch_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Backfill: users who signed up before this migration ran.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  nullif(left(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), 120), ''),
  nullif(left(coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture', ''), 2048), '')
from auth.users u
on conflict (id) do nothing;
