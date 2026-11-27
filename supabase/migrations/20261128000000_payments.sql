-- PrettyBills: payments, receipts and the activity log.
-- Run after 20261127000000_billing.sql, in Supabase → SQL Editor or with
-- `supabase db push`. Safe to re-run.
--
-- How the money stays right:
--   * Payments are the only source of what an invoice has received. A trigger
--     on invoices recomputes amount_paid, status and paid_at from them on
--     every write, so neither the editor nor a hand-made API call can set them.
--   * Payments and receipts are written only by the functions below
--     (record_payment, update_payment, delete_payment). Each runs in one
--     transaction and locks the invoice row first, so two people paying the
--     same balance at once can't overpay it.
--   * Nothing is hard-deleted: a deleted payment is kept with deleted_at, its
--     receipt is voided, and receipt numbers are never reused.
--
-- One user is one business here (there's no team table), so "business" in the
-- product spec maps to user_id. Invoice and client ids are the app's text ids.
-- Money is integer paise. Business dates are Asia/Kolkata.

create schema if not exists private;

-- ===========================================================================
-- Types
-- ===========================================================================
do $$ begin
  create type public.payment_mode as enum ('upi', 'cash', 'bank_transfer', 'cheque', 'card', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_source as enum ('manual', 'gateway', 'client_claim');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.receipt_status as enum ('active', 'void');
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- Invoices: what the payments say, as columns lists can filter on.
-- status keeps its existing values; the money part of it (partially_paid,
-- paid) is now set only by the trigger further down.
-- ===========================================================================
alter table public.invoices
  add column if not exists payment_state text generated always as (
    case when total > 0 and amount_paid >= total then 'paid' when amount_paid > 0 then 'partially_paid' else 'unpaid' end
  ) stored,
  add column if not exists voided_at timestamptz;

create index if not exists invoices_user_paid_idx on public.invoices (user_id, paid_at desc) where status = 'paid';

-- ===========================================================================
-- Payments
-- ===========================================================================
create table if not exists public.payments (
  id                 uuid                  primary key default gen_random_uuid(),
  user_id            uuid                  not null references auth.users (id) on delete cascade,
  invoice_id         text                  not null references public.invoices (id),
  client_id          text                  check (char_length(client_id) <= 64),
  amount_paise       bigint                not null check (amount_paise > 0),
  paid_on            date                  not null,
  mode               public.payment_mode   not null,
  reference          text                  check (char_length(reference) <= 64),
  note               text                  check (char_length(note) <= 500),
  source             public.payment_source not null default 'manual',
  gateway_payment_id text                  unique,
  idempotency_key    uuid                  not null,
  created_by         uuid                  references auth.users (id) on delete set null,
  updated_by         uuid                  references auth.users (id) on delete set null,
  created_at         timestamptz           not null default now(),
  updated_at         timestamptz           not null default now(),
  deleted_at         timestamptz,
  deleted_by         uuid                  references auth.users (id) on delete set null,
  delete_reason      text                  check (char_length(delete_reason) <= 200),
  unique (user_id, idempotency_key)
);

comment on table public.payments is 'Money received against an invoice. Written only by record_payment / update_payment / delete_payment.';

create index if not exists payments_user_paid_on_idx on public.payments (user_id, paid_on desc, created_at desc, id) where deleted_at is null;
create index if not exists payments_invoice_idx on public.payments (invoice_id) where deleted_at is null;
create index if not exists payments_client_idx on public.payments (user_id, client_id) where deleted_at is null;
create index if not exists payments_user_mode_idx on public.payments (user_id, mode) where deleted_at is null;

-- ===========================================================================
-- Receipts: exactly one per payment.
-- ===========================================================================
create table if not exists public.receipts (
  id           uuid                  primary key default gen_random_uuid(),
  user_id      uuid                  not null references auth.users (id) on delete cascade,
  payment_id   uuid                  not null unique references public.payments (id),
  invoice_id   text                  not null references public.invoices (id),
  client_id    text                  check (char_length(client_id) <= 64),
  number       text                  not null check (char_length(number) <= 40),
  receipt_date date                  not null,
  revision     int                   not null default 1 check (revision >= 1),
  status       public.receipt_status not null default 'active',
  template_id  text                  not null default 'standard' check (char_length(template_id) <= 40),
  page_color   text                  not null default 'white' check (page_color in ('white', 'black')),
  language     text                  not null default 'en' check (char_length(language) <= 10),
  public_token text                  not null unique check (public_token ~ '^[A-Za-z0-9_-]{32,96}$'),
  link_active  boolean               not null default true,
  emailed_at   timestamptz,
  email_count  int                   not null default 0 check (email_count >= 0),
  voided_at    timestamptz,
  void_reason  text                  check (char_length(void_reason) <= 200),
  created_at   timestamptz           not null default now(),
  updated_at   timestamptz           not null default now(),
  unique (user_id, number)
);

comment on table public.receipts is 'Payment receipts. Numbered RCPT/<FY>/<NNN> per user and financial year; never deleted.';

create index if not exists receipts_user_date_idx on public.receipts (user_id, receipt_date desc, created_at desc);
create index if not exists receipts_invoice_idx on public.receipts (invoice_id);

-- ===========================================================================
-- Gap-free document numbers, per user, document type and financial year.
-- ===========================================================================
create table if not exists public.document_sequences (
  user_id    uuid not null references auth.users (id) on delete cascade,
  doc_type   text not null check (doc_type in ('receipt')),
  fy         text not null check (fy ~ '^\d{2}-\d{2}$'),
  prefix     text not null default 'RCPT' check (char_length(prefix) between 1 and 12),
  next_value int  not null default 1 check (next_value >= 1),
  padding    int  not null default 3 check (padding between 1 and 8),
  primary key (user_id, doc_type, fy)
);

-- ===========================================================================
-- Activity log for payments and receipts. Invoice lifecycle events (sent,
-- viewed, downloaded…) stay in invoice_events; timelines show both.
-- Append-only: nobody gets update or delete.
-- ===========================================================================
create table if not exists public.activities (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  entity_type text        not null check (entity_type in ('invoice', 'payment', 'receipt', 'client', 'export')),
  entity_id   text        not null check (char_length(entity_id) <= 96),
  invoice_id  text,
  client_id   text,
  action      text        not null check (char_length(action) <= 60),
  actor_id    uuid        references auth.users (id) on delete set null,
  data        jsonb       not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 8000),
  created_at  timestamptz not null default now()
);

create index if not exists activities_invoice_idx on public.activities (user_id, invoice_id, created_at desc);
create index if not exists activities_entity_idx on public.activities (user_id, entity_type, entity_id, created_at desc);
create index if not exists activities_client_idx on public.activities (user_id, client_id, created_at desc);

-- ===========================================================================
-- Privileges and RLS: owners can read. Writes go through the functions.
-- ===========================================================================
revoke all on public.payments, public.receipts, public.document_sequences, public.activities from anon, authenticated;
grant select on public.payments, public.receipts, public.document_sequences, public.activities to authenticated;

alter table public.payments enable row level security;
alter table public.receipts enable row level security;
alter table public.document_sequences enable row level security;
alter table public.activities enable row level security;

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists receipts_select_own on public.receipts;
create policy receipts_select_own on public.receipts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists document_sequences_select_own on public.document_sequences;
create policy document_sequences_select_own on public.document_sequences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists activities_select_own on public.activities;
create policy activities_select_own on public.activities for select to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments for each row execute function private.touch_updated_at();
drop trigger if exists receipts_touch on public.receipts;
create trigger receipts_touch before update on public.receipts for each row execute function private.touch_updated_at();

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- Indian financial year label: 2026-11-25 → '26-27', 2027-04-01 → '27-28'.
create or replace function public.fy_label(d date)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.lpad(((extract(year from d)::int - case when extract(month from d) < 4 then 1 else 0 end) % 100)::text, 2, '0')
      || '-'
      || pg_catalog.lpad(((extract(year from d)::int - case when extract(month from d) < 4 then 1 else 0 end + 1) % 100)::text, 2, '0')
$$;

grant execute on function public.fy_label(date) to anon, authenticated;

-- Today in India.
create or replace function private.today_ist()
returns date
language sql
stable
set search_path = ''
as $$ select (pg_catalog.now() at time zone 'Asia/Kolkata')::date $$;

-- Next number for a document. The update's row lock serialises callers, and a
-- rolled-back transaction gives its number back, so numbers have no gaps.
create or replace function private.next_document_number(p_user uuid, p_doc_type text, p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fy     text := public.fy_label(p_date);
  v_number text;
begin
  insert into public.document_sequences (user_id, doc_type, fy, prefix)
  values (p_user, p_doc_type, v_fy, case p_doc_type when 'receipt' then 'RCPT' else upper(p_doc_type) end)
  on conflict (user_id, doc_type, fy) do nothing;

  update public.document_sequences s
     set next_value = s.next_value + 1
   where s.user_id = p_user and s.doc_type = p_doc_type and s.fy = v_fy
  returning s.prefix || '/' || s.fy || '/' || pg_catalog.lpad((s.next_value - 1)::text, s.padding, '0') into v_number;

  return v_number;
end;
$$;

-- 64 URL-safe random characters (two v4 uuids' worth of randomness).
create or replace function private.random_token()
returns text
language sql
volatile
set search_path = ''
as $$ select pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') $$;

create or replace function private.log_activity(p_user uuid, p_entity_type text, p_entity_id text, p_invoice text, p_client text, p_action text, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activities (user_id, entity_type, entity_id, invoice_id, client_id, action, actor_id, data)
  values (p_user, p_entity_type, p_entity_id, p_invoice, p_client, p_action, auth.uid(), coalesce(p_data, '{}'::jsonb))
$$;

-- Errors the app turns into messages. The code is the message; detail carries numbers.
create or replace function private.fail(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end;
$$;

revoke all on function private.today_ist(), private.next_document_number(uuid, text, date), private.random_token(),
  private.log_activity(uuid, text, text, text, text, text, jsonb), private.fail(text, text) from public, anon, authenticated;

-- ===========================================================================
-- The invoice money trigger. Runs before every insert/update of an invoice:
-- amount_paid comes from the payments, status follows the money, and edits
-- that would contradict recorded payments are refused.
-- ===========================================================================
create or replace function private.invoice_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid    bigint;
  v_paid_on date;
  v_before  text;
  v_after   text;
begin
  select coalesce(sum(p.amount_paise), 0) into v_paid
  from public.payments p
  where p.invoice_id = new.id and p.deleted_at is null;

  new.amount_paid := v_paid;

  if v_paid > 0 then
    if new.status = 'void' then
      perform private.fail('HAS_PAYMENTS');
    end if;
    if new.status = 'draft' then
      perform private.fail('HAS_PAYMENTS');
    end if;
    if new.total < v_paid then
      perform private.fail('TOTAL_BELOW_PAID', v_paid::text);
    end if;
    if tg_op = 'UPDATE' then
      if new.client_id is distinct from old.client_id then
        perform private.fail('CLIENT_LOCKED');
      end if;
    end if;
  end if;

  if new.status not in ('draft', 'void') then
    new.status := case
      when new.total > 0 and v_paid >= new.total then 'paid'
      when v_paid > 0 then 'partially_paid'
      when new.viewed_at is not null then 'viewed'
      else 'sent'
    end;
  end if;

  if new.status = 'paid' then
    -- the payment that took the running total to the invoice total
    select s.paid_on into v_paid_on
    from (
      select p.paid_on, sum(p.amount_paise) over (order by p.paid_on, p.created_at, p.id) as running
      from public.payments p
      where p.invoice_id = new.id and p.deleted_at is null
    ) s
    where s.running >= new.total
    order by s.paid_on
    limit 1;
    new.paid_at := coalesce((v_paid_on::timestamp at time zone 'Asia/Kolkata'), new.paid_at, pg_catalog.now());
  else
    new.paid_at := null;
  end if;

  if new.status = 'void' and new.voided_at is null then
    new.voided_at := pg_catalog.now();
  elsif new.status <> 'void' then
    new.voided_at := null;
  end if;

  -- keep the stored document in step with the columns
  new.data := pg_catalog.jsonb_set(new.data, '{status}', pg_catalog.to_jsonb(new.status));
  if new.data ? 'payment' then
    new.data := pg_catalog.jsonb_set(new.data, '{payment,amountPaid}', pg_catalog.to_jsonb(v_paid));
  end if;

  if tg_op = 'UPDATE' then
    v_before := case when old.total > 0 and old.amount_paid >= old.total then 'paid' when old.amount_paid > 0 then 'partially_paid' else 'unpaid' end;
    v_after := case when new.total > 0 and v_paid >= new.total then 'paid' when v_paid > 0 then 'partially_paid' else 'unpaid' end;
    if v_before <> v_after then
      perform private.log_activity(new.user_id, 'invoice', new.id, new.id, new.client_id, 'invoice.payment_state_changed', pg_catalog.jsonb_build_object('before', v_before, 'after', v_after));
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.invoice_money() from public, anon, authenticated;

-- Creates the receipt for a payment just inserted. Template, page colour and
-- language come from the invoice so the receipt matches it.
create or replace function private.create_receipt(p_payment public.payments)
returns public.receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv     public.invoices;
  v_receipt public.receipts;
begin
  select * into v_inv from public.invoices where id = p_payment.invoice_id;
  insert into public.receipts (user_id, payment_id, invoice_id, client_id, number, receipt_date, template_id, page_color, language, public_token)
  values (
    p_payment.user_id, p_payment.id, p_payment.invoice_id, p_payment.client_id,
    private.next_document_number(p_payment.user_id, 'receipt', p_payment.paid_on),
    p_payment.paid_on,
    coalesce(nullif(v_inv.template_id, ''), 'standard'),
    case when v_inv.data ->> 'pageColor' = 'black' then 'black' else 'white' end,
    coalesce(nullif(v_inv.data ->> 'language', ''), 'en'),
    private.random_token()
  )
  returning * into v_receipt;
  return v_receipt;
end;
$$;

revoke all on function private.create_receipt(public.payments) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Before the trigger exists: amounts typed into older invoices become real
-- payments (with receipts), so nothing anyone already recorded disappears.
-- Only rows without payments are touched, so a re-run does nothing.
-- ---------------------------------------------------------------------------
do $$
declare
  r public.invoices;
  p public.payments;
begin
  for r in
    select i.* from public.invoices i
    where i.amount_paid > 0
      and i.total > 0
      and i.status not in ('draft', 'void')
      and not exists (select 1 from public.payments x where x.invoice_id = i.id)
    order by i.user_id, coalesce(i.paid_at, i.issue_date::timestamptz), i.created_at
  loop
    insert into public.payments (user_id, invoice_id, client_id, amount_paise, paid_on, mode, note, idempotency_key, created_by)
    values (
      r.user_id, r.id, r.client_id, least(r.amount_paid, r.total),
      least(coalesce((r.paid_at at time zone 'Asia/Kolkata')::date, r.issue_date), private.today_ist()),
      'other', 'Recorded on the invoice before payments were tracked', pg_catalog.gen_random_uuid(), r.user_id
    )
    returning * into p;
    perform private.create_receipt(p);
  end loop;
end $$;

drop trigger if exists invoices_money on public.invoices;
create trigger invoices_money before insert or update on public.invoices for each row execute function private.invoice_money();

-- ===========================================================================
-- What the app gets back after a payment change.
-- ===========================================================================
create or replace function private.payment_result(p_payment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'payment', pg_catalog.to_jsonb(p) - 'idempotency_key',
    'receipt', pg_catalog.to_jsonb(r),
    'invoice', pg_catalog.jsonb_build_object(
      'id', i.id, 'number', i.number, 'total', i.total, 'amount_paid', i.amount_paid,
      'balance_due', i.balance_due, 'status', i.status, 'payment_state', i.payment_state, 'paid_at', i.paid_at
    )
  )
  from public.payments p
  join public.receipts r on r.payment_id = p.id
  join public.invoices i on i.id = p.invoice_id
  where p.id = p_payment_id
$$;

revoke all on function private.payment_result(uuid) from public, anon, authenticated;

create or replace function private.check_payment_input(p_amount bigint, p_paid_on date, p_reference text, p_note text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then perform private.fail('INVALID_AMOUNT'); end if;
  if p_paid_on is null then perform private.fail('INVALID_INPUT', 'paid_on'); end if;
  if p_paid_on > private.today_ist() then perform private.fail('FUTURE_DATE'); end if;
  if p_paid_on < date '2000-01-01' then perform private.fail('INVALID_INPUT', 'paid_on'); end if;
  if char_length(coalesce(p_reference, '')) > 64 then perform private.fail('INVALID_INPUT', 'reference'); end if;
  if char_length(coalesce(p_note, '')) > 500 then perform private.fail('INVALID_INPUT', 'note'); end if;
end;
$$;

revoke all on function private.check_payment_input(bigint, date, text, text) from public, anon, authenticated;

-- ===========================================================================
-- record_payment: payment + receipt + invoice state, in one transaction.
-- The same idempotency key returns the first result instead of paying twice.
-- ===========================================================================
create or replace function public.record_payment(
  p_invoice_id      text,
  p_amount_paise    bigint,
  p_paid_on         date,
  p_mode            public.payment_mode,
  p_reference       text,
  p_note            text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_inv     public.invoices;
  v_payment public.payments;
  v_receipt public.receipts;
  v_ref     text := nullif(pg_catalog.btrim(p_reference), '');
  v_note    text := nullif(pg_catalog.btrim(p_note), '');
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if p_idempotency_key is null then perform private.fail('INVALID_INPUT', 'idempotency_key'); end if;

  -- lock first: concurrent payments on one invoice queue up here
  select * into v_inv from public.invoices where id = p_invoice_id and user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;

  select * into v_payment from public.payments where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    return private.payment_result(v_payment.id) || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  if v_inv.status = 'draft' then perform private.fail('INVOICE_NOT_SENT'); end if;
  if v_inv.status = 'void' then perform private.fail('INVOICE_VOID'); end if;
  perform private.check_payment_input(p_amount_paise, p_paid_on, v_ref, v_note);
  if p_amount_paise > v_inv.balance_due then perform private.fail('OVERPAYMENT', v_inv.balance_due::text); end if;

  insert into public.payments (user_id, invoice_id, client_id, amount_paise, paid_on, mode, reference, note, idempotency_key, created_by)
  values (v_uid, v_inv.id, v_inv.client_id, p_amount_paise, p_paid_on, p_mode, v_ref, v_note, p_idempotency_key, v_uid)
  returning * into v_payment;

  v_receipt := private.create_receipt(v_payment);

  -- the trigger recomputes amount paid, status and paid date
  update public.invoices set updated_at = pg_catalog.now() where id = v_inv.id;

  perform private.log_activity(v_uid, 'payment', v_payment.id::text, v_inv.id, v_inv.client_id, 'payment.recorded',
    pg_catalog.jsonb_build_object('amount_paise', p_amount_paise, 'mode', p_mode, 'reference', v_ref, 'paid_on', p_paid_on, 'receipt_number', v_receipt.number, 'invoice_number', v_inv.number));
  perform private.log_activity(v_uid, 'receipt', v_receipt.id::text, v_inv.id, v_inv.client_id, 'receipt.created',
    pg_catalog.jsonb_build_object('number', v_receipt.number, 'amount_paise', p_amount_paise));

  return private.payment_result(v_payment.id);
end;
$$;

-- ===========================================================================
-- update_payment: same checks; the receipt keeps its number and gains a revision.
-- ===========================================================================
create or replace function public.update_payment(
  p_payment_id   uuid,
  p_amount_paise bigint,
  p_paid_on      date,
  p_mode         public.payment_mode,
  p_reference    text,
  p_note         text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_invoice text;
  v_inv     public.invoices;
  v_old     public.payments;
  v_new     public.payments;
  v_receipt public.receipts;
  v_ref     text := nullif(pg_catalog.btrim(p_reference), '');
  v_note    text := nullif(pg_catalog.btrim(p_note), '');
  v_before  jsonb := '{}'::jsonb;
  v_after   jsonb := '{}'::jsonb;
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;

  select invoice_id into v_invoice from public.payments where id = p_payment_id and user_id = v_uid;
  if v_invoice is null then perform private.fail('NOT_FOUND'); end if;

  -- same lock order as record_payment: invoice, then payment
  select * into v_inv from public.invoices where id = v_invoice and user_id = v_uid for update;
  select * into v_old from public.payments where id = p_payment_id for update;
  if v_old.deleted_at is not null then perform private.fail('NOT_FOUND'); end if;
  if v_inv.status = 'void' then perform private.fail('INVOICE_VOID'); end if;

  perform private.check_payment_input(p_amount_paise, p_paid_on, v_ref, v_note);
  if p_amount_paise > v_inv.balance_due + v_old.amount_paise then
    perform private.fail('OVERPAYMENT', (v_inv.balance_due + v_old.amount_paise)::text);
  end if;

  if v_old.amount_paise <> p_amount_paise then
    v_before := v_before || pg_catalog.jsonb_build_object('amount_paise', v_old.amount_paise);
    v_after := v_after || pg_catalog.jsonb_build_object('amount_paise', p_amount_paise);
  end if;
  if v_old.paid_on <> p_paid_on then
    v_before := v_before || pg_catalog.jsonb_build_object('paid_on', v_old.paid_on);
    v_after := v_after || pg_catalog.jsonb_build_object('paid_on', p_paid_on);
  end if;
  if v_old.mode <> p_mode then
    v_before := v_before || pg_catalog.jsonb_build_object('mode', v_old.mode);
    v_after := v_after || pg_catalog.jsonb_build_object('mode', p_mode);
  end if;
  if v_old.reference is distinct from v_ref then
    v_before := v_before || pg_catalog.jsonb_build_object('reference', v_old.reference);
    v_after := v_after || pg_catalog.jsonb_build_object('reference', v_ref);
  end if;
  if v_old.note is distinct from v_note then
    v_before := v_before || pg_catalog.jsonb_build_object('note', v_old.note);
    v_after := v_after || pg_catalog.jsonb_build_object('note', v_note);
  end if;

  if v_after = '{}'::jsonb then
    return private.payment_result(p_payment_id) || pg_catalog.jsonb_build_object('unchanged', true);
  end if;

  update public.payments
     set amount_paise = p_amount_paise, paid_on = p_paid_on, mode = p_mode, reference = v_ref, note = v_note, updated_by = v_uid
   where id = p_payment_id
  returning * into v_new;

  update public.receipts
     set receipt_date = p_paid_on, revision = revision + 1
   where payment_id = p_payment_id
  returning * into v_receipt;

  update public.invoices set updated_at = pg_catalog.now() where id = v_inv.id;

  perform private.log_activity(v_uid, 'payment', p_payment_id::text, v_inv.id, v_inv.client_id, 'payment.updated',
    pg_catalog.jsonb_build_object('before', v_before, 'after', v_after, 'receipt_number', v_receipt.number, 'invoice_number', v_inv.number));
  perform private.log_activity(v_uid, 'receipt', v_receipt.id::text, v_inv.id, v_inv.client_id, 'receipt.revised',
    pg_catalog.jsonb_build_object('number', v_receipt.number, 'revision', v_receipt.revision,
      'fy_changed', public.fy_label(p_paid_on) <> public.fy_label(v_old.paid_on)));

  return private.payment_result(p_payment_id);
end;
$$;

-- ===========================================================================
-- delete_payment: soft delete, receipt voided (its number stays taken).
-- ===========================================================================
create or replace function public.delete_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_invoice text;
  v_inv     public.invoices;
  v_pay     public.payments;
  v_receipt public.receipts;
  v_reason  text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then perform private.fail('INVALID_REASON'); end if;

  select invoice_id into v_invoice from public.payments where id = p_payment_id and user_id = v_uid;
  if v_invoice is null then perform private.fail('NOT_FOUND'); end if;

  select * into v_inv from public.invoices where id = v_invoice and user_id = v_uid for update;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.deleted_at is not null then perform private.fail('NOT_FOUND'); end if;

  update public.payments set deleted_at = pg_catalog.now(), deleted_by = v_uid, delete_reason = v_reason, updated_by = v_uid where id = p_payment_id;
  update public.receipts
     set status = 'void', voided_at = pg_catalog.now(), void_reason = v_reason, link_active = false
   where payment_id = p_payment_id
  returning * into v_receipt;

  update public.invoices set updated_at = pg_catalog.now() where id = v_inv.id;

  perform private.log_activity(v_uid, 'payment', p_payment_id::text, v_inv.id, v_inv.client_id, 'payment.deleted',
    pg_catalog.jsonb_build_object('amount_paise', v_pay.amount_paise, 'reason', v_reason, 'receipt_number', v_receipt.number, 'invoice_number', v_inv.number));
  perform private.log_activity(v_uid, 'receipt', v_receipt.id::text, v_inv.id, v_inv.client_id, 'receipt.voided',
    pg_catalog.jsonb_build_object('number', v_receipt.number, 'reason', v_reason));

  return private.payment_result(p_payment_id);
end;
$$;

-- ===========================================================================
-- Small writes the server makes after a payment: receipt emailed / shared,
-- CSV exported. Owner only; nothing here touches money.
-- ===========================================================================
create or replace function public.note_receipt_event(p_receipt_id uuid, p_action text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_r   public.receipts;
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if p_action not in ('receipt.emailed', 'receipt.email_failed', 'receipt.shared') then perform private.fail('INVALID_INPUT', 'action'); end if;
  select * into v_r from public.receipts where id = p_receipt_id and user_id = v_uid;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if p_action = 'receipt.emailed' then
    update public.receipts set emailed_at = pg_catalog.now(), email_count = email_count + 1 where id = p_receipt_id;
  end if;
  perform private.log_activity(v_uid, 'receipt', p_receipt_id::text, v_r.invoice_id, v_r.client_id, p_action,
    coalesce(p_data, '{}'::jsonb) || pg_catalog.jsonb_build_object('number', v_r.number));
end;
$$;

create or replace function public.note_export(p_action text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if p_action not in ('payments.exported', 'statement.exported') then perform private.fail('INVALID_INPUT', 'action'); end if;
  perform private.log_activity(v_uid, 'export', p_action, null, coalesce(p_data ->> 'client_id', null), p_action, coalesce(p_data, '{}'::jsonb));
end;
$$;

-- ===========================================================================
-- Public receipt link: whoever has the token sees the receipt while the link
-- is on. Returns only what the page renders.
-- ===========================================================================
create or replace function public.shared_receipt(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'receipt', pg_catalog.jsonb_build_object('id', r.id, 'number', r.number, 'receipt_date', r.receipt_date, 'revision', r.revision, 'status', r.status,
      'template_id', r.template_id, 'page_color', r.page_color, 'language', r.language, 'created_at', r.created_at),
    'payment', pg_catalog.jsonb_build_object('id', p.id, 'amount_paise', p.amount_paise, 'paid_on', p.paid_on, 'mode', p.mode, 'reference', p.reference, 'created_at', p.created_at),
    'invoice', (i.data - 'internalNote') || pg_catalog.jsonb_build_object('status', i.status, 'total', i.total),
    'invoice_link', case when i.link_active and i.status <> 'void' then i.public_token end,
    -- what had been paid before this receipt, in the same order receipts are numbered in
    'paid_before', coalesce((
      select sum(o.amount_paise) from public.payments o
      where o.invoice_id = p.invoice_id and o.deleted_at is null and o.id <> p.id
        and (o.paid_on, o.created_at, o.id) < (p.paid_on, p.created_at, p.id)
    ), 0)
  )
  from public.receipts r
  join public.payments p on p.id = r.payment_id
  join public.invoices i on i.id = r.invoice_id
  where r.public_token = p_token and r.link_active and r.status = 'active'
$$;

-- ===========================================================================
-- Overview for the dashboard, sidebar and lists. Replaces the earlier version:
-- collections now come from payments, and there are metrics for the cards.
-- ===========================================================================
create or replace function public.invoice_overview(p_today date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select
      i.status, i.total, i.balance_due, i.missing_fields, i.paid_at, i.issue_date, i.due_date,
      (i.status in ('sent', 'viewed', 'partially_paid')) as open,
      (i.status in ('sent', 'viewed', 'partially_paid') and i.due_date < p_today and i.balance_due > 0) as late
    from public.invoices i
    where i.user_id = (select auth.uid())
  ),
  pay as (
    select p.amount_paise, p.paid_on
    from public.payments p
    where p.user_id = (select auth.uid()) and p.deleted_at is null
      and p.paid_on >= (date_trunc('month', p_today::timestamp) - interval '1 month')::date
  ),
  speed as (
    select greatest(0, ((i.paid_at at time zone 'Asia/Kolkata')::date - i.issue_date)) as days
    from public.invoices i
    where i.user_id = (select auth.uid()) and i.status = 'paid' and i.paid_at is not null
      and (i.paid_at at time zone 'Asia/Kolkata')::date > p_today - 90
  )
  select pg_catalog.jsonb_build_object(
    'all',                  count(*),
    'drafts',               count(*) filter (where status = 'draft'),
    'drafts_ready',         count(*) filter (where status = 'draft' and missing_fields = 0),
    'sent',                 count(*) filter (where open and not late),
    'overdue',              count(*) filter (where late),
    'paid',                 count(*) filter (where status = 'paid'),
    'outstanding',          coalesce(sum(balance_due) filter (where open), 0),
    'outstanding_count',    count(*) filter (where open and balance_due > 0),
    'overdue_amount',       coalesce(sum(balance_due) filter (where late), 0),
    'oldest_overdue_days',  coalesce(max(p_today - due_date) filter (where late), 0),
    'collected_month',      (select coalesce(sum(amount_paise), 0) from pay where paid_on >= date_trunc('month', p_today::timestamp)::date and paid_on <= p_today),
    'collected_last_month', (select coalesce(sum(amount_paise), 0) from pay where paid_on < date_trunc('month', p_today::timestamp)::date),
    'avg_days_to_pay',      (select round(avg(days)) from speed),
    'avg_days_sample',      (select count(*) from speed),
    'invoiced_month',       coalesce(sum(total) filter (where status not in ('draft', 'void') and issue_date >= date_trunc('month', p_today::timestamp)::date), 0),
    'invoiced_month_count', count(*) filter (where status not in ('draft', 'void') and issue_date >= date_trunc('month', p_today::timestamp)::date)
  )
  from mine
$$;

-- ===========================================================================
-- Read models for the Payments and Receipts pages. security_invoker makes the
-- views run as the caller, so the tables' RLS still decides what's visible.
-- ===========================================================================
create or replace view public.payment_rows with (security_invoker = true) as
  select
    p.id, p.user_id, p.invoice_id, p.client_id, p.amount_paise, p.paid_on, p.mode, p.reference, p.note, p.source,
    p.created_at, p.created_by, p.updated_at, p.deleted_at,
    i.number as invoice_number, i.issue_date as invoice_date, i.total as invoice_total, i.status as invoice_status,
    coalesce(i.client_name, '') as client_name, i.data -> 'billTo' ->> 'gstin' as client_gstin,
    r.id as receipt_id, r.number as receipt_number, r.status as receipt_status, r.revision as receipt_revision, r.emailed_at as receipt_emailed_at
  from public.payments p
  join public.invoices i on i.id = p.invoice_id
  left join public.receipts r on r.payment_id = p.id;

create or replace view public.receipt_rows with (security_invoker = true) as
  select
    r.id, r.user_id, r.number, r.receipt_date, r.revision, r.status, r.public_token, r.link_active, r.emailed_at, r.email_count,
    r.voided_at, r.void_reason, r.created_at, r.invoice_id, r.client_id, r.payment_id,
    p.amount_paise, p.mode, p.reference, p.paid_on,
    i.number as invoice_number, coalesce(i.client_name, '') as client_name
  from public.receipts r
  join public.payments p on p.id = r.payment_id
  join public.invoices i on i.id = r.invoice_id;

revoke all on public.payment_rows, public.receipt_rows from anon, authenticated;
grant select on public.payment_rows, public.receipt_rows to authenticated;

-- Totals for the Payments page, with the same filters as its list.
create or replace function public.payment_summary(p_from date, p_to date, p_clients text[] default null, p_modes public.payment_mode[] default null, p_q text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select v.amount_paise, v.mode
    from public.payment_rows v
    where v.deleted_at is null
      and (p_from is null or v.paid_on >= p_from)
      and (p_to is null or v.paid_on <= p_to)
      and (p_clients is null or v.client_id = any (p_clients))
      and (p_modes is null or v.mode = any (p_modes))
      and (p_q is null or p_q = '' or v.reference ilike '%' || p_q || '%' or v.invoice_number ilike '%' || p_q || '%' or v.client_name ilike '%' || p_q || '%' or v.receipt_number ilike '%' || p_q || '%')
  )
  select pg_catalog.jsonb_build_object(
    'total', coalesce(sum(amount_paise), 0),
    'count', count(*),
    'by_mode', coalesce((select pg_catalog.jsonb_object_agg(mode, s) from (select mode, sum(amount_paise) s from f group by mode) m), '{}'::jsonb)
  )
  from f
$$;

-- ===========================================================================
-- Who may call what
-- ===========================================================================
revoke all on function public.record_payment(text, bigint, date, public.payment_mode, text, text, uuid) from public;
revoke all on function public.update_payment(uuid, bigint, date, public.payment_mode, text, text) from public;
revoke all on function public.delete_payment(uuid, text) from public;
revoke all on function public.note_receipt_event(uuid, text, jsonb) from public;
revoke all on function public.note_export(text, jsonb) from public;
revoke all on function public.shared_receipt(text) from public;
revoke all on function public.invoice_overview(date) from public;
revoke all on function public.payment_summary(date, date, text[], public.payment_mode[], text) from public;

grant execute on function public.record_payment(text, bigint, date, public.payment_mode, text, text, uuid) to authenticated;
grant execute on function public.update_payment(uuid, bigint, date, public.payment_mode, text, text) to authenticated;
grant execute on function public.delete_payment(uuid, text) to authenticated;
grant execute on function public.note_receipt_event(uuid, text, jsonb) to authenticated;
grant execute on function public.note_export(text, jsonb) to authenticated;
grant execute on function public.shared_receipt(text) to anon, authenticated;
grant execute on function public.invoice_overview(date) to authenticated;
grant execute on function public.payment_summary(date, date, text[], public.payment_mode[], text) to authenticated;

-- ===========================================================================
-- Optional: log "became overdue" once per invoice, at 00:10 IST every day.
-- Needs the pg_cron extension (Supabase → Database → Extensions). Overdue is
-- always computed live; this only feeds the activity log and, later, reminders.
-- ===========================================================================
create or replace function private.log_newly_overdue()
returns int
language sql
security definer
set search_path = ''
as $$
  with late as (
    insert into public.activities (user_id, entity_type, entity_id, invoice_id, client_id, action, data)
    select i.user_id, 'invoice', i.id, i.id, i.client_id, 'invoice.became_overdue', pg_catalog.jsonb_build_object('due_date', i.due_date, 'balance_paise', i.balance_due)
    from public.invoices i
    where i.status in ('sent', 'viewed', 'partially_paid') and i.balance_due > 0 and i.due_date < private.today_ist()
      and not exists (select 1 from public.activities a where a.invoice_id = i.id and a.user_id = i.user_id and a.action = 'invoice.became_overdue')
    returning 1
  )
  select count(*)::int from late
$$;

revoke all on function private.log_newly_overdue() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('prettybills-overdue', '40 18 * * *', 'select private.log_newly_overdue()'); -- 18:40 UTC = 00:10 IST
  end if;
exception when others then
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;
