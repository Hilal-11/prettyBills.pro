-- ===========================================================================
-- Credit notes, credit allocations and refunds.
--
-- Under GST a sent invoice isn't edited down: a credit note referencing it
-- reduces what the client owes. Issuing one applies its value to the invoice
-- (up to the balance); anything left is unapplied credit, which can be
-- applied to another invoice of the same client or refunded.
--
-- Fits this codebase: rows belong to user_id (one user = one business);
-- invoice lines live in invoices.data, so a credit note line points at the
-- line's id (text) and carries that line's original taxable value, which
-- caps what can be credited on it across all issued notes.
--
-- invoices gains credited_paise (Σ active allocations, kept by the money
-- trigger) and balance_due becomes total − settled − credited.
-- Additive and idempotent; the CLI applies the file as one transaction.
-- ===========================================================================

do $$ begin
  create type public.credit_note_status as enum ('draft', 'issued', 'void');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.credit_note_reason as enum ('sales_return', 'post_sale_discount', 'service_deficiency', 'invoice_correction', 'tax_correction', 'cancellation', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.credit_notes (
  id                      uuid                      primary key default gen_random_uuid(),
  user_id                 uuid                      not null references auth.users (id) on delete cascade,
  client_id               text                      check (char_length(client_id) <= 64),
  invoice_id              text                      not null references public.invoices (id),
  number                  text                      check (char_length(number) <= 40),
  cn_date                 date                      not null,
  status                  public.credit_note_status not null default 'draft',
  reason                  public.credit_note_reason not null,
  reason_text             text                      check (char_length(reason_text) <= 300),
  mode                    text                      not null check (mode in ('items', 'lump_sum')),
  from_snapshot           jsonb                     not null default '{}'::jsonb,
  bill_to_snapshot        jsonb                     not null default '{}'::jsonb,
  original_invoice_number text                      not null,
  original_invoice_date   date                      not null,
  place_of_supply         text                      not null default '',
  supply_type             text                      not null default '',
  tax_type                text                      not null check (tax_type in ('igst', 'cgst_sgst', 'none')),
  taxable_paise           bigint                    not null default 0 check (taxable_paise >= 0),
  cgst_paise              bigint                    not null default 0 check (cgst_paise >= 0),
  sgst_paise              bigint                    not null default 0 check (sgst_paise >= 0),
  igst_paise              bigint                    not null default 0 check (igst_paise >= 0),
  round_off_paise         bigint                    not null default 0,
  total_paise             bigint                    not null default 0 check (total_paise >= 0),
  applied_paise           bigint                    not null default 0 check (applied_paise >= 0),
  refunded_paise          bigint                    not null default 0 check (refunded_paise >= 0),
  unapplied_paise         bigint                    generated always as (total_paise - applied_paise - refunded_paise) stored,
  is_late_for_gst         boolean                   not null default false,
  template_id             text                      not null default 'standard' check (char_length(template_id) <= 40),
  page_color              text                      not null default 'white' check (page_color in ('white', 'black')),
  language                text                      not null default 'en' check (char_length(language) <= 10),
  notes                   text                      check (char_length(notes) <= 1000),
  public_token            text                      unique check (public_token ~ '^[A-Za-z0-9_-]{32,96}$'),
  link_active             boolean                   not null default true,
  emailed_at              timestamptz,
  issued_at               timestamptz,
  voided_at               timestamptz,
  void_reason             text                      check (char_length(void_reason) <= 200),
  idempotency_key         uuid                      not null,
  created_by              uuid                      references auth.users (id) on delete set null,
  created_at              timestamptz               not null default now(),
  updated_at              timestamptz               not null default now(),
  unique (user_id, number),
  unique (user_id, idempotency_key),
  check (status <> 'issued' or number is not null),
  check (reason <> 'other' or char_length(coalesce(reason_text, '')) >= 3)
);

comment on table public.credit_notes is 'GST credit notes against a sent invoice. Numbered CN/<FY>/<NNN> on issue; never deleted once issued.';

create table if not exists public.credit_note_items (
  id                 uuid    primary key default gen_random_uuid(),
  credit_note_id     uuid    not null references public.credit_notes (id) on delete cascade,
  invoice_item_id    text    check (char_length(invoice_item_id) <= 96),  -- the line's id in invoices.data; null for lump sum
  position           int     not null,
  name               text    not null check (char_length(name) between 1 and 300),
  description        text    check (char_length(description) <= 1000),
  hsn_sac            text    check (char_length(hsn_sac) <= 10),
  qty                numeric(14, 3) not null check (qty > 0),
  unit               text    check (char_length(unit) <= 20),
  rate_paise         bigint  not null check (rate_paise >= 0),
  discount_paise     bigint  not null default 0 check (discount_paise >= 0),
  taxable_paise      bigint  not null check (taxable_paise >= 0),
  tax_rate_bp        int     not null check (tax_rate_bp between 0 and 10000),
  tax_paise          bigint  not null check (tax_paise >= 0),
  total_paise        bigint  not null check (total_paise >= 0),
  orig_taxable_paise bigint  check (orig_taxable_paise >= 0)            -- the invoice line's taxable value (the per-line cap)
);

create table if not exists public.credit_allocations (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  credit_note_id  uuid        not null references public.credit_notes (id),
  invoice_id      text        not null references public.invoices (id),
  amount_paise    bigint      not null check (amount_paise > 0),
  applied_on      date        not null,
  idempotency_key uuid,
  created_by      uuid        references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  reversed_at     timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.refunds (
  id              uuid                primary key default gen_random_uuid(),
  user_id         uuid                not null references auth.users (id) on delete cascade,
  credit_note_id  uuid                not null references public.credit_notes (id),
  client_id       text                check (char_length(client_id) <= 64),
  amount_paise    bigint              not null check (amount_paise > 0),
  refunded_on     date                not null,
  mode            public.payment_mode not null,
  reference       text                check (char_length(reference) <= 64),
  note            text                check (char_length(note) <= 500),
  idempotency_key uuid                not null,
  created_by      uuid                references auth.users (id) on delete set null,
  created_at      timestamptz         not null default now(),
  deleted_at      timestamptz,
  deleted_by      uuid                references auth.users (id) on delete set null,
  delete_reason   text                check (char_length(delete_reason) <= 200),
  unique (user_id, idempotency_key)
);

create index if not exists credit_notes_user_date_idx on public.credit_notes (user_id, cn_date desc, created_at desc);
create index if not exists credit_notes_user_status_idx on public.credit_notes (user_id, status);
create index if not exists credit_notes_invoice_idx on public.credit_notes (invoice_id);
create index if not exists credit_notes_client_unapplied_idx on public.credit_notes (user_id, client_id) where status = 'issued' and unapplied_paise > 0;
create index if not exists credit_note_items_note_idx on public.credit_note_items (credit_note_id);
create index if not exists credit_note_items_line_idx on public.credit_note_items (invoice_item_id) where invoice_item_id is not null;
create index if not exists credit_allocations_note_idx on public.credit_allocations (credit_note_id);
create index if not exists credit_allocations_invoice_idx on public.credit_allocations (invoice_id) where reversed_at is null;
create index if not exists refunds_note_idx on public.refunds (credit_note_id) where deleted_at is null;
create index if not exists refunds_user_date_idx on public.refunds (user_id, refunded_on desc) where deleted_at is null;

alter table public.credit_notes enable row level security;
alter table public.credit_note_items enable row level security;
alter table public.credit_allocations enable row level security;
alter table public.refunds enable row level security;

revoke all on public.credit_notes, public.credit_note_items, public.credit_allocations, public.refunds from anon, authenticated;
grant select on public.credit_notes, public.credit_note_items, public.credit_allocations, public.refunds to authenticated;

drop policy if exists credit_notes_select_own on public.credit_notes;
create policy credit_notes_select_own on public.credit_notes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists credit_note_items_select_own on public.credit_note_items;
create policy credit_note_items_select_own on public.credit_note_items for select to authenticated
  using (exists (select 1 from public.credit_notes n where n.id = credit_note_id and n.user_id = (select auth.uid())));
drop policy if exists credit_allocations_select_own on public.credit_allocations;
create policy credit_allocations_select_own on public.credit_allocations for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists refunds_select_own on public.refunds;
create policy refunds_select_own on public.refunds for select to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists credit_notes_touch on public.credit_notes;
create trigger credit_notes_touch before update on public.credit_notes for each row execute function private.touch_updated_at();

-- numbering and the activity log know about credit notes and refunds
alter table public.document_sequences drop constraint if exists document_sequences_doc_type_check;
alter table public.document_sequences add constraint document_sequences_doc_type_check check (doc_type in ('receipt', 'credit_note'));
alter table public.activities drop constraint if exists activities_entity_type_check;
alter table public.activities add constraint activities_entity_type_check check (entity_type in ('invoice', 'payment', 'receipt', 'client', 'export', 'credit_note', 'refund'));

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
  values (p_user, p_doc_type, v_fy, case p_doc_type when 'receipt' then 'RCPT' when 'credit_note' then 'CN' else upper(p_doc_type) end)
  on conflict (user_id, doc_type, fy) do nothing;

  update public.document_sequences s
     set next_value = s.next_value + 1
   where s.user_id = p_user and s.doc_type = p_doc_type and s.fy = v_fy
  returning s.prefix || '/' || s.fy || '/' || pg_catalog.lpad((s.next_value - 1)::text, s.padding, '0') into v_number;

  return v_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoices: credits settle them too.
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists credited_paise bigint not null default 0,
  add column if not exists cancelled boolean not null default false;

-- balance_due is derived (generated), so it can be redefined: total − settled − credited
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices' and column_name = 'balance_due'
      and generation_expression like '%credited_paise%'
  ) then
    alter table public.invoices drop column if exists balance_due;
    alter table public.invoices add column balance_due bigint generated always as (greatest(total - amount_paid - credited_paise, 0)) stored;
  end if;
end $$;

create or replace function private.invoice_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid    bigint;
  v_tds     bigint;
  v_credit  bigint;
  v_settled bigint;
  v_has_cn  boolean;
  v_paid_on date;
  v_before  text;
  v_after   text;
begin
  select coalesce(sum(p.amount_paise + p.tds_paise), 0), coalesce(sum(p.tds_paise), 0) into v_paid, v_tds
  from public.payments p
  where p.invoice_id = new.id and p.deleted_at is null;

  select coalesce(sum(a.amount_paise), 0) into v_credit
  from public.credit_allocations a
  where a.invoice_id = new.id and a.reversed_at is null;

  select exists (select 1 from public.credit_notes n where n.invoice_id = new.id and n.status = 'issued') into v_has_cn;

  new.amount_paid := v_paid;
  new.tds_paise := v_tds;
  new.credited_paise := v_credit;
  v_settled := v_paid + v_credit;

  if v_paid > 0 and new.status in ('void', 'draft') then
    perform private.fail('HAS_PAYMENTS');
  end if;
  if v_has_cn and new.status in ('void', 'draft') then
    perform private.fail('HAS_CREDIT_NOTES');
  end if;
  if v_settled > 0 and new.total < v_settled then
    perform private.fail('TOTAL_BELOW_PAID', v_settled::text);
  end if;
  if (v_paid > 0 or v_has_cn) and tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
    perform private.fail('CLIENT_LOCKED');
  end if;

  if new.status not in ('draft', 'void') then
    new.status := case
      when new.total > 0 and v_settled >= new.total then 'paid'
      when v_settled > 0 then 'partially_paid'
      when new.viewed_at is not null then 'viewed'
      else 'sent'
    end;
  end if;

  -- cancelled: fully credited by a cancellation credit note
  new.cancelled := new.total > 0 and v_credit >= new.total and exists (
    select 1 from public.credit_allocations a join public.credit_notes n on n.id = a.credit_note_id
    where a.invoice_id = new.id and a.reversed_at is null and n.status = 'issued' and n.reason = 'cancellation'
  );

  if new.status = 'paid' then
    -- the payment or credit that took the running total to the invoice total
    select s.d into v_paid_on
    from (
      select x.d, sum(x.amt) over (order by x.d, x.at, x.id) as running
      from (
        select p.paid_on as d, p.created_at as at, p.id::text as id, p.amount_paise + p.tds_paise as amt
        from public.payments p where p.invoice_id = new.id and p.deleted_at is null
        union all
        select a.applied_on, a.created_at, a.id::text, a.amount_paise
        from public.credit_allocations a where a.invoice_id = new.id and a.reversed_at is null
      ) x
    ) s
    where s.running >= new.total
    order by s.d
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

  new.data := pg_catalog.jsonb_set(new.data, '{status}', pg_catalog.to_jsonb(new.status));
  if new.data ? 'payment' then
    new.data := pg_catalog.jsonb_set(new.data, '{payment,amountPaid}', pg_catalog.to_jsonb(v_settled));
  end if;

  if tg_op = 'UPDATE' then
    v_before := case when old.total > 0 and old.amount_paid + old.credited_paise >= old.total then 'paid' when old.amount_paid + old.credited_paise > 0 then 'partially_paid' else 'unpaid' end;
    v_after := case when new.total > 0 and v_settled >= new.total then 'paid' when v_settled > 0 then 'partially_paid' else 'unpaid' end;
    if v_before <> v_after then
      perform private.log_activity(new.user_id, 'invoice', new.id, new.id, new.client_id, 'invoice.payment_state_changed', pg_catalog.jsonb_build_object('before', v_before, 'after', v_after));
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.invoice_money() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- What the credit note has settled elsewhere: applied to invoices, refunded.
create or replace function private.recompute_credit_note(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.credit_notes n set
    applied_paise = coalesce((select sum(a.amount_paise) from public.credit_allocations a where a.credit_note_id = n.id and a.reversed_at is null), 0),
    refunded_paise = coalesce((select sum(r.amount_paise) from public.refunds r where r.credit_note_id = n.id and r.deleted_at is null), 0)
  where n.id = p_id
$$;

-- GST time limit: credit for a note dated after 30 November following the end
-- of the original invoice's financial year may not be claimable.
create or replace function public.credit_note_gst_deadline(p_invoice_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(extract(year from p_invoice_date)::int + case when extract(month from p_invoice_date) >= 4 then 1 else 0 end, 11, 30)
$$;

-- Every rule a credit note's figures must meet against its invoice.
-- p_exclude: the note being saved or issued (its own lines don't count against it).
create or replace function private.check_credit_note(p_inv public.invoices, p_doc jsonb, p_exclude uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items       jsonb := coalesce(p_doc -> 'items', '[]'::jsonb);
  v_total       bigint := coalesce((p_doc ->> 'total_paise')::bigint, -1);
  v_taxable     bigint := coalesce((p_doc ->> 'taxable_paise')::bigint, -1);
  v_tax         bigint := coalesce((p_doc ->> 'cgst_paise')::bigint, 0) + coalesce((p_doc ->> 'sgst_paise')::bigint, 0) + coalesce((p_doc ->> 'igst_paise')::bigint, 0);
  v_round       bigint := coalesce((p_doc ->> 'round_off_paise')::bigint, 0);
  v_credited    bigint;
  v_date        date := (p_doc ->> 'cn_date')::date;
  v_line        record;
  v_sum_taxable bigint := 0;
begin
  if p_inv.status = 'draft' then perform private.fail('INVOICE_NOT_SENT'); end if;
  if p_inv.status = 'void' then perform private.fail('INVOICE_VOID'); end if;
  if v_date is null or v_date > private.today_ist() then perform private.fail('FUTURE_DATE'); end if;
  if v_date < p_inv.issue_date then perform private.fail('INVALID_INPUT', 'cn_date'); end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 200 then perform private.fail('INVALID_INPUT', 'items'); end if;
  if v_total <= 0 or v_taxable < 0 then perform private.fail('INVALID_AMOUNT'); end if;
  if abs(v_round) > 100 and coalesce(p_doc ->> 'reason', '') <> 'cancellation' then perform private.fail('INVALID_INPUT', 'round_off'); end if;

  select coalesce(sum((i ->> 'taxable_paise')::bigint), 0) into v_sum_taxable from jsonb_array_elements(v_items) i;
  if v_sum_taxable <> v_taxable then perform private.fail('INVALID_INPUT', 'taxable'); end if;
  if v_total <> v_taxable + v_tax + v_round then perform private.fail('INVALID_INPUT', 'total'); end if;

  -- the invoice can't be credited past its total
  select coalesce(sum(n.total_paise), 0) into v_credited
  from public.credit_notes n
  where n.invoice_id = p_inv.id and n.status = 'issued' and n.id is distinct from p_exclude;
  if v_credited + v_total > p_inv.total then perform private.fail('CREDIT_EXCEEDS_INVOICE', greatest(p_inv.total - v_credited, 0)::text); end if;

  -- nor any line past its own value
  for v_line in
    select i ->> 'invoice_item_id' as line_id, sum((i ->> 'taxable_paise')::bigint) as taxable, max((i ->> 'orig_taxable_paise')::bigint) as orig
    from jsonb_array_elements(v_items) i
    where coalesce(i ->> 'invoice_item_id', '') <> ''
    group by 1
  loop
    if v_line.orig is null then perform private.fail('INVALID_INPUT', 'orig_taxable'); end if;
    if v_line.taxable + coalesce((
      select sum(ci.taxable_paise) from public.credit_note_items ci
      join public.credit_notes n on n.id = ci.credit_note_id
      where n.invoice_id = p_inv.id and n.status = 'issued' and n.id is distinct from p_exclude and ci.invoice_item_id = v_line.line_id
    ), 0) > v_line.orig then
      perform private.fail('LINE_CREDIT_EXCEEDED', v_line.line_id);
    end if;
  end loop;
end;
$$;

revoke all on function private.recompute_credit_note(uuid), private.check_credit_note(public.invoices, jsonb, uuid) from public, anon, authenticated;

-- Writes the note's header and lines from the server-computed document.
create or replace function private.write_credit_note(p_uid uuid, p_id uuid, p_inv public.invoices, p_doc jsonb, p_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_reason public.credit_note_reason := (p_doc ->> 'reason')::public.credit_note_reason;
  v_text text := nullif(pg_catalog.btrim(p_doc ->> 'reason_text'), '');
begin
  if v_reason = 'other' and char_length(coalesce(v_text, '')) < 3 then perform private.fail('INVALID_INPUT', 'reason_text'); end if;
  if coalesce(p_doc ->> 'mode', '') not in ('items', 'lump_sum') then perform private.fail('INVALID_INPUT', 'mode'); end if;

  if v_id is null then
    insert into public.credit_notes (user_id, client_id, invoice_id, cn_date, reason, reason_text, mode, from_snapshot, bill_to_snapshot,
      original_invoice_number, original_invoice_date, place_of_supply, supply_type, tax_type, taxable_paise, cgst_paise, sgst_paise, igst_paise,
      round_off_paise, total_paise, template_id, page_color, language, notes, idempotency_key, created_by)
    values (p_uid, p_inv.client_id, p_inv.id, (p_doc ->> 'cn_date')::date, v_reason, v_text, p_doc ->> 'mode',
      coalesce(p_inv.data -> 'from', '{}'::jsonb), coalesce(p_inv.data -> 'billTo', '{}'::jsonb),
      p_inv.number, p_inv.issue_date, coalesce(p_inv.data ->> 'placeOfSupply', ''), coalesce(p_inv.data ->> 'supplyType', ''),
      coalesce(p_doc ->> 'tax_type', 'none'), (p_doc ->> 'taxable_paise')::bigint, coalesce((p_doc ->> 'cgst_paise')::bigint, 0),
      coalesce((p_doc ->> 'sgst_paise')::bigint, 0), coalesce((p_doc ->> 'igst_paise')::bigint, 0), coalesce((p_doc ->> 'round_off_paise')::bigint, 0),
      (p_doc ->> 'total_paise')::bigint, coalesce(nullif(p_inv.template_id, ''), 'standard'),
      case when p_inv.data ->> 'pageColor' = 'black' then 'black' else 'white' end, coalesce(nullif(p_inv.data ->> 'language', ''), 'en'),
      nullif(pg_catalog.btrim(p_doc ->> 'notes'), ''), p_key, p_uid)
    returning id into v_id;
  else
    update public.credit_notes set
      cn_date = (p_doc ->> 'cn_date')::date, reason = v_reason, reason_text = v_text, mode = p_doc ->> 'mode',
      tax_type = coalesce(p_doc ->> 'tax_type', 'none'), taxable_paise = (p_doc ->> 'taxable_paise')::bigint,
      cgst_paise = coalesce((p_doc ->> 'cgst_paise')::bigint, 0), sgst_paise = coalesce((p_doc ->> 'sgst_paise')::bigint, 0),
      igst_paise = coalesce((p_doc ->> 'igst_paise')::bigint, 0), round_off_paise = coalesce((p_doc ->> 'round_off_paise')::bigint, 0),
      total_paise = (p_doc ->> 'total_paise')::bigint, notes = nullif(pg_catalog.btrim(p_doc ->> 'notes'), ''),
      from_snapshot = coalesce(p_inv.data -> 'from', '{}'::jsonb), bill_to_snapshot = coalesce(p_inv.data -> 'billTo', '{}'::jsonb)
    where id = v_id;
    delete from public.credit_note_items where credit_note_id = v_id;
  end if;

  insert into public.credit_note_items (credit_note_id, invoice_item_id, position, name, description, hsn_sac, qty, unit, rate_paise, discount_paise,
    taxable_paise, tax_rate_bp, tax_paise, total_paise, orig_taxable_paise)
  select v_id, nullif(i ->> 'invoice_item_id', ''), (ord - 1)::int, coalesce(nullif(i ->> 'name', ''), 'Adjustment'), nullif(i ->> 'description', ''),
    nullif(i ->> 'hsn_sac', ''), (i ->> 'qty')::numeric, nullif(i ->> 'unit', ''), (i ->> 'rate_paise')::bigint, coalesce((i ->> 'discount_paise')::bigint, 0),
    (i ->> 'taxable_paise')::bigint, (i ->> 'tax_rate_bp')::int, (i ->> 'tax_paise')::bigint, (i ->> 'total_paise')::bigint, (i ->> 'orig_taxable_paise')::bigint
  from jsonb_array_elements(p_doc -> 'items') with ordinality as t(i, ord);

  return v_id;
end;
$$;

revoke all on function private.write_credit_note(uuid, uuid, public.invoices, jsonb, uuid) from public, anon, authenticated;

-- Issues a draft: number, allocation to its invoice, totals, log.
create or replace function private.issue(p_uid uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cn  public.credit_notes;
  v_inv public.invoices;
  v_doc jsonb;
  v_amt bigint;
begin
  select * into v_cn from public.credit_notes where id = p_id and user_id = p_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_cn.status <> 'draft' then perform private.fail('INVALID_INPUT', 'status'); end if;
  select * into v_inv from public.invoices where id = v_cn.invoice_id and user_id = p_uid for update;

  -- re-check: another note may have been issued since this one was saved
  v_doc := pg_catalog.to_jsonb(v_cn) || pg_catalog.jsonb_build_object('items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(ci)) from public.credit_note_items ci where ci.credit_note_id = p_id), '[]'::jsonb));
  perform private.check_credit_note(v_inv, v_doc, p_id);

  update public.credit_notes set
    status = 'issued',
    number = private.next_document_number(p_uid, 'credit_note', v_cn.cn_date),
    issued_at = pg_catalog.now(),
    is_late_for_gst = v_cn.cn_date > public.credit_note_gst_deadline(v_cn.original_invoice_date),
    public_token = private.random_token(),
    -- the client and invoice as they are now
    from_snapshot = coalesce(v_inv.data -> 'from', '{}'::jsonb),
    bill_to_snapshot = coalesce(v_inv.data -> 'billTo', '{}'::jsonb)
  where id = p_id
  returning * into v_cn;

  v_amt := least(v_cn.total_paise, v_inv.balance_due);
  if v_amt > 0 then
    insert into public.credit_allocations (user_id, credit_note_id, invoice_id, amount_paise, applied_on, created_by)
    values (p_uid, p_id, v_inv.id, v_amt, v_cn.cn_date, p_uid);
  end if;
  update public.invoices set updated_at = pg_catalog.now() where id = v_inv.id; -- the trigger recomputes credited, balance and status
  perform private.recompute_credit_note(p_id);
  select * into v_cn from public.credit_notes where id = p_id;

  perform private.log_activity(p_uid, 'credit_note', p_id::text, v_inv.id, v_inv.client_id, 'credit_note.issued',
    pg_catalog.jsonb_build_object('number', v_cn.number, 'total_paise', v_cn.total_paise, 'reason', v_cn.reason, 'invoice_number', v_inv.number, 'late_for_gst', v_cn.is_late_for_gst));
  if v_amt > 0 then
    perform private.log_activity(p_uid, 'credit_note', p_id::text, v_inv.id, v_inv.client_id, 'credit_note.applied',
      pg_catalog.jsonb_build_object('number', v_cn.number, 'amount_paise', v_amt, 'invoice_number', v_inv.number));
  end if;
  return private.credit_note_result(p_id);
end;
$$;

create or replace function private.credit_note_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'credit_note', pg_catalog.to_jsonb(n) - 'idempotency_key',
    'invoice', pg_catalog.jsonb_build_object('id', i.id, 'number', i.number, 'total', i.total, 'amount_paid', i.amount_paid, 'credited_paise', i.credited_paise,
      'balance_due', i.balance_due, 'status', i.status, 'cancelled', i.cancelled)
  )
  from public.credit_notes n join public.invoices i on i.id = n.invoice_id
  where n.id = p_id
$$;

revoke all on function private.issue(uuid, uuid), private.credit_note_result(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public functions (owner only; every check again on the server)
-- ---------------------------------------------------------------------------

-- Create or update a draft. p_id null creates (idempotent on p_idempotency_key).
create or replace function public.save_credit_note_draft(p_id uuid, p_invoice_id text, p_doc jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invoices;
  v_cn  public.credit_notes;
  v_id  uuid;
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if p_id is null then
    if p_idempotency_key is null then perform private.fail('INVALID_INPUT', 'idempotency_key'); end if;
    select * into v_cn from public.credit_notes where user_id = v_uid and idempotency_key = p_idempotency_key;
    if found then return private.credit_note_result(v_cn.id) || pg_catalog.jsonb_build_object('replayed', true); end if;
  else
    select * into v_cn from public.credit_notes where id = p_id and user_id = v_uid for update;
    if not found then perform private.fail('NOT_FOUND'); end if;
    if v_cn.status <> 'draft' then perform private.fail('INVALID_INPUT', 'status'); end if;
  end if;
  select * into v_inv from public.invoices where id = coalesce(v_cn.invoice_id, p_invoice_id) and user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  perform private.check_credit_note(v_inv, p_doc, p_id);
  v_id := private.write_credit_note(v_uid, p_id, v_inv, p_doc, coalesce(p_idempotency_key, pg_catalog.gen_random_uuid()));
  if p_id is null then
    perform private.log_activity(v_uid, 'credit_note', v_id::text, v_inv.id, v_inv.client_id, 'credit_note.drafted',
      pg_catalog.jsonb_build_object('total_paise', (p_doc ->> 'total_paise')::bigint, 'invoice_number', v_inv.number));
  end if;
  return private.credit_note_result(v_id);
end;
$$;

create or replace function public.issue_credit_note(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then perform private.fail('FORBIDDEN'); end if;
  return private.issue(auth.uid(), p_id);
end;
$$;

-- Saves and issues in one transaction (the editor's "Issue", and "Cancel invoice").
create or replace function public.create_and_issue_credit_note(p_id uuid, p_invoice_id text, p_doc jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saved jsonb;
  v_id uuid;
begin
  if auth.uid() is null then perform private.fail('FORBIDDEN'); end if;
  v_saved := public.save_credit_note_draft(p_id, p_invoice_id, p_doc, p_idempotency_key);
  v_id := (v_saved -> 'credit_note' ->> 'id')::uuid;
  if v_saved -> 'credit_note' ->> 'status' = 'issued' then return v_saved; end if; -- a replay of an issued note
  return private.issue(auth.uid(), v_id);
end;
$$;

create or replace function public.delete_credit_note_draft(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cn  public.credit_notes;
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  select * into v_cn from public.credit_notes where id = p_id and user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_cn.status <> 'draft' then perform private.fail('INVALID_INPUT', 'status'); end if;
  delete from public.credit_notes where id = p_id;
  perform private.log_activity(v_uid, 'credit_note', p_id::text, v_cn.invoice_id, v_cn.client_id, 'credit_note.draft_deleted', '{}'::jsonb);
end;
$$;

-- Apply a note's unapplied credit to another open invoice of the same client.
create or replace function public.apply_client_credit(p_credit_note_id uuid, p_invoice_id text, p_amount_paise bigint, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cn  public.credit_notes;
  v_inv public.invoices;
  v_done public.credit_allocations;
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if p_idempotency_key is null then perform private.fail('INVALID_INPUT', 'idempotency_key'); end if;
  select * into v_done from public.credit_allocations where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then return private.credit_note_result(v_done.credit_note_id) || pg_catalog.jsonb_build_object('replayed', true); end if;

  -- lock order: invoice, then note (as issue does)
  select * into v_inv from public.invoices where id = p_invoice_id and user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  select * into v_cn from public.credit_notes where id = p_credit_note_id and user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_cn.status <> 'issued' then perform private.fail('INVALID_INPUT', 'status'); end if;
  if v_cn.client_id is null or v_inv.client_id is distinct from v_cn.client_id then perform private.fail('CLIENT_MISMATCH'); end if;
  if v_inv.status = 'draft' then perform private.fail('INVOICE_NOT_SENT'); end if;
  if v_inv.status = 'void' then perform private.fail('INVOICE_VOID'); end if;
  if p_amount_paise is null or p_amount_paise <= 0 then perform private.fail('INVALID_AMOUNT'); end if;
  if p_amount_paise > v_cn.unapplied_paise then perform private.fail('REFUND_EXCEEDS_CREDIT', v_cn.unapplied_paise::text); end if;
  if p_amount_paise > v_inv.balance_due then perform private.fail('OVERPAYMENT', v_inv.balance_due::text); end if;

  insert into public.credit_allocations (user_id, credit_note_id, invoice_id, amount_paise, applied_on, idempotency_key, created_by)
  values (v_uid, v_cn.id, v_inv.id, p_amount_paise, private.today_ist(), p_idempotency_key, v_uid);
  update public.invoices set updated_at = pg_catalog.now() where id = v_inv.id;
  perform private.recompute_credit_note(v_cn.id);
  perform private.log_activity(v_uid, 'credit_note', v_cn.id::text, v_inv.id, v_inv.client_id, 'credit_note.applied',
    pg_catalog.jsonb_build_object('number', v_cn.number, 'amount_paise', p_amount_paise, 'invoice_number', v_inv.number));
  return private.credit_note_result(v_cn.id);
end;
$$;

create or replace function public.record_refund(p_credit_note_id uuid, p_amount_paise bigint, p_refunded_on date, p_mode public.payment_mode, p_reference text, p_note text, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cn  public.credit_notes;
  v_r   public.refunds;
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if p_idempotency_key is null then perform private.fail('INVALID_INPUT', 'idempotency_key'); end if;
  select * into v_r from public.refunds where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then return private.credit_note_result(v_r.credit_note_id) || pg_catalog.jsonb_build_object('replayed', true); end if;

  select * into v_cn from public.credit_notes where id = p_credit_note_id and user_id = v_uid for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_cn.status <> 'issued' then perform private.fail('INVALID_INPUT', 'status'); end if;
  if p_amount_paise is null or p_amount_paise <= 0 then perform private.fail('INVALID_AMOUNT'); end if;
  if p_amount_paise > v_cn.unapplied_paise then perform private.fail('REFUND_EXCEEDS_CREDIT', v_cn.unapplied_paise::text); end if;
  if p_refunded_on is null or p_refunded_on > private.today_ist() then perform private.fail('FUTURE_DATE'); end if;
  if char_length(coalesce(p_reference, '')) > 64 or char_length(coalesce(p_note, '')) > 500 then perform private.fail('INVALID_INPUT', 'reference'); end if;

  insert into public.refunds (user_id, credit_note_id, client_id, amount_paise, refunded_on, mode, reference, note, idempotency_key, created_by)
  values (v_uid, v_cn.id, v_cn.client_id, p_amount_paise, p_refunded_on, p_mode, nullif(pg_catalog.btrim(p_reference), ''), nullif(pg_catalog.btrim(p_note), ''), p_idempotency_key, v_uid)
  returning * into v_r;
  perform private.recompute_credit_note(v_cn.id);
  perform private.log_activity(v_uid, 'refund', v_r.id::text, v_cn.invoice_id, v_cn.client_id, 'refund.recorded',
    pg_catalog.jsonb_build_object('number', v_cn.number, 'amount_paise', p_amount_paise, 'mode', p_mode, 'refunded_on', p_refunded_on));
  return private.credit_note_result(v_cn.id);
end;
$$;

create or replace function public.delete_refund(p_refund_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_r      public.refunds;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then perform private.fail('INVALID_REASON'); end if;
  select * into v_r from public.refunds where id = p_refund_id and user_id = v_uid;
  if not found or v_r.deleted_at is not null then perform private.fail('NOT_FOUND'); end if;
  perform 1 from public.credit_notes where id = v_r.credit_note_id for update;
  update public.refunds set deleted_at = pg_catalog.now(), deleted_by = v_uid, delete_reason = v_reason where id = p_refund_id;
  perform private.recompute_credit_note(v_r.credit_note_id);
  perform private.log_activity(v_uid, 'refund', p_refund_id::text, null, v_r.client_id, 'refund.deleted',
    pg_catalog.jsonb_build_object('amount_paise', v_r.amount_paise, 'reason', v_reason));
  return private.credit_note_result(v_r.credit_note_id);
end;
$$;

-- Void: allocations reversed, invoices recomputed (they may go back to overdue), link off.
create or replace function public.void_credit_note(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_cn     public.credit_notes;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_inv    text;
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then perform private.fail('INVALID_REASON'); end if;
  select * into v_cn from public.credit_notes where id = p_id and user_id = v_uid;
  if not found then perform private.fail('NOT_FOUND'); end if;
  if v_cn.status <> 'issued' then perform private.fail('INVALID_INPUT', 'status'); end if;
  -- lock the invoices it touched first (same order as issue/apply), then the note
  perform 1 from public.invoices where id in (select a.invoice_id from public.credit_allocations a where a.credit_note_id = p_id and a.reversed_at is null) order by id for update;
  select * into v_cn from public.credit_notes where id = p_id for update;
  if exists (select 1 from public.refunds r where r.credit_note_id = p_id and r.deleted_at is null) then perform private.fail('HAS_REFUNDS'); end if;

  update public.credit_allocations set reversed_at = pg_catalog.now() where credit_note_id = p_id and reversed_at is null;
  update public.credit_notes set status = 'void', voided_at = pg_catalog.now(), void_reason = v_reason, link_active = false where id = p_id;
  for v_inv in select distinct a.invoice_id from public.credit_allocations a where a.credit_note_id = p_id loop
    update public.invoices set updated_at = pg_catalog.now() where id = v_inv;
  end loop;
  perform private.recompute_credit_note(p_id);
  perform private.log_activity(v_uid, 'credit_note', p_id::text, v_cn.invoice_id, v_cn.client_id, 'credit_note.voided',
    pg_catalog.jsonb_build_object('number', v_cn.number, 'reason', v_reason, 'total_paise', v_cn.total_paise));
  return private.credit_note_result(p_id);
end;
$$;

-- Public credit note link: the note while its link is on.
create or replace function public.shared_credit_note(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'credit_note', pg_catalog.to_jsonb(n) - 'idempotency_key' - 'notes_internal',
    'items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(ci) order by ci.position) from public.credit_note_items ci where ci.credit_note_id = n.id), '[]'::jsonb)
  )
  from public.credit_notes n
  where n.public_token = p_token and n.link_active and n.status = 'issued'
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
revoke all on function public.save_credit_note_draft(uuid, text, jsonb, uuid), public.issue_credit_note(uuid),
  public.create_and_issue_credit_note(uuid, text, jsonb, uuid), public.delete_credit_note_draft(uuid),
  public.apply_client_credit(uuid, text, bigint, uuid), public.record_refund(uuid, bigint, date, public.payment_mode, text, text, uuid),
  public.delete_refund(uuid, text), public.void_credit_note(uuid, text), public.shared_credit_note(text) from public;

grant execute on function public.save_credit_note_draft(uuid, text, jsonb, uuid), public.issue_credit_note(uuid),
  public.create_and_issue_credit_note(uuid, text, jsonb, uuid), public.delete_credit_note_draft(uuid),
  public.apply_client_credit(uuid, text, bigint, uuid), public.record_refund(uuid, bigint, date, public.payment_mode, text, text, uuid),
  public.delete_refund(uuid, text), public.void_credit_note(uuid, text) to authenticated;
grant execute on function public.shared_credit_note(text) to anon, authenticated;
grant execute on function public.credit_note_gst_deadline(date) to anon, authenticated;
