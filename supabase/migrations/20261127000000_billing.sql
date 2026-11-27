-- PrettyBills: plans (Pro subscriptions) and email usage
-- Run in Supabase → SQL Editor, or with `supabase db push`. Safe to re-run.
--
-- subscriptions: one row per paying user. Written only by the server with the
--   service role (the Razorpay webhook), never by the browser, so nobody can
--   give themselves Pro. Users can read their own row.
-- email_sends:   one row per invoice email that left PrettyBills. Counts the
--   monthly allowance. Insert and read only: rows can't be edited or deleted
--   by users, and they outlive the invoice, so deleting invoices doesn't reset
--   the count.

-- ===========================================================================
-- subscriptions
-- ===========================================================================
create table if not exists public.subscriptions (
  user_id                  uuid        primary key references auth.users (id) on delete cascade,
  plan                     text        not null check (plan in ('pro_monthly', 'pro_yearly')),
  -- Razorpay's subscription states
  status                   text        not null check (status in ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'paused')),
  current_period_end       timestamptz,
  cancel_at_period_end     boolean     not null default false,
  razorpay_subscription_id text        unique,
  razorpay_customer_id     text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.subscriptions is 'Pro subscriptions. Written by the payment webhook (service role); users read their own.';

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions for each row execute function private.touch_updated_at();

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- email_sends
-- ===========================================================================
create table if not exists public.email_sends (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  invoice_id  text        not null check (char_length(invoice_id) <= 96),
  message_id  text        check (char_length(message_id) <= 128),
  recipients  smallint    not null default 1 check (recipients between 1 and 50),
  at          timestamptz not null default now()
);

comment on table public.email_sends is 'Invoice emails sent through PrettyBills, for the monthly allowance. Insert-only for users.';

create index if not exists email_sends_user_at_idx on public.email_sends (user_id, at desc);

revoke all on public.email_sends from anon, authenticated;
grant select, insert (user_id, invoice_id, message_id, recipients) on public.email_sends to authenticated;

alter table public.email_sends enable row level security;

drop policy if exists email_sends_select_own on public.email_sends;
create policy email_sends_select_own on public.email_sends
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists email_sends_insert_own on public.email_sends;
create policy email_sends_insert_own on public.email_sends
  for insert to authenticated
  with check (user_id = (select auth.uid()));
