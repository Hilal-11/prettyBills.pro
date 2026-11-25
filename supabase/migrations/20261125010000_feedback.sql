-- PrettyBills: in-app feedback
-- Anyone (guest or signed in) can send feedback; nobody can read it through the
-- API. Read it in the Supabase dashboard (Table editor → feedback) or with the
-- service role. Run in Supabase → SQL Editor, or with `supabase db push`. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id          bigint      generated always as identity primary key,
  user_id     uuid        references auth.users (id) on delete set null,
  topic       text        not null check (topic in ('idea', 'bug', 'invoice', 'account', 'other')),
  message     text        not null check (char_length(message) between 3 and 2000),
  mood        smallint    check (mood between 1 and 4),
  email       text        check (char_length(email) <= 254),
  page        text        check (char_length(page) <= 512),
  user_agent  text        check (char_length(user_agent) <= 512),
  created_at  timestamptz not null default now()
);

comment on table public.feedback is 'Messages from the in-app feedback form. Insert-only for clients.';

-- foreign keys aren't indexed automatically
create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- ---------------------------------------------------------------------------
-- Privileges: clients may only INSERT these columns. No SELECT, UPDATE or
-- DELETE, so one visitor can never read another's message.
-- ---------------------------------------------------------------------------
revoke all on public.feedback from anon, authenticated;
grant insert (user_id, topic, message, mood, email, page, user_agent) on public.feedback to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: guests can't claim to be a user, and users can only
-- send as themselves.
-- ---------------------------------------------------------------------------
alter table public.feedback enable row level security;

drop policy if exists feedback_insert_guest on public.feedback;
create policy feedback_insert_guest on public.feedback
  for insert to anon
  with check (user_id is null);

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (user_id is null or user_id = (select auth.uid()));
