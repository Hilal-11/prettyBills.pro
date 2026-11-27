-- PrettyBills: Razorpay webhook log.
-- Run after 20261127000000_billing.sql. Safe to re-run.
--
-- Every webhook Razorpay sends is stored once, keyed by its event id, so a
-- retried delivery is recognised and skipped. Only the server (service role)
-- reads or writes it: signed-in users and visitors get nothing.

create table if not exists public.billing_events (
  id               text        primary key check (char_length(id) <= 100),  -- x-razorpay-event-id
  event            text        not null check (char_length(event) <= 60),
  subscription_id  text        check (char_length(subscription_id) <= 60),
  user_id          uuid        references auth.users (id) on delete set null,
  payload          jsonb       not null check (pg_column_size(payload) <= 200000),
  outcome          text        check (char_length(outcome) <= 200),
  received_at      timestamptz not null default now()
);

comment on table public.billing_events is 'Razorpay webhooks, one row per event id. Service role only.';

create index if not exists billing_events_subscription_idx on public.billing_events (subscription_id, received_at desc);

revoke all on public.billing_events from anon, authenticated;
alter table public.billing_events enable row level security;
-- no policies: only the service role (which bypasses RLS) can touch it
