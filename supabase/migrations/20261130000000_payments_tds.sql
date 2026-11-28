-- ===========================================================================
-- TDS on payments.
--
-- Many business clients deduct TDS before paying. One payment now has two
-- parts: amount_paise (money that reached the bank) and tds_paise (tax the
-- client deducted and deposits in the business's name). Both settle the
-- invoice: settled = amount + TDS.
--
-- Naming in this codebase: invoices.amount_paid has always meant "settled",
-- and balance_due = total − amount_paid is a generated column, so it keeps
-- that meaning (now amount + TDS). invoices.tds_paise is the TDS part, so
-- cash received = amount_paid − tds_paise.
--
-- Additive and idempotent: new columns have defaults, functions gain
-- optional parameters (callers that don't send TDS keep working), nothing
-- that holds data is dropped. The Supabase CLI applies the file as one
-- transaction, so it's all or nothing.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists tds_paise bigint not null default 0,
  add column if not exists tds_section text,
  add column if not exists tds_rate_bp int,
  add column if not exists tds_certificate_received boolean not null default false;

alter table public.invoices
  add column if not exists tds_paise bigint not null default 0;

-- amount may now be 0 (all of it deducted as TDS) as long as something is settled
alter table public.payments drop constraint if exists payments_amount_paise_check;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_amount_nonnegative') then
    alter table public.payments add constraint payments_amount_nonnegative check (amount_paise >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_tds_nonnegative') then
    alter table public.payments add constraint payments_tds_nonnegative check (tds_paise >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_settles_something') then
    alter table public.payments add constraint payments_settles_something check (amount_paise + tds_paise > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_tds_needs_section') then
    alter table public.payments add constraint payments_tds_needs_section check (tds_paise = 0 or tds_section is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_tds_section_len') then
    alter table public.payments add constraint payments_tds_section_len check (tds_section is null or char_length(tds_section) between 1 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_tds_rate_range') then
    alter table public.payments add constraint payments_tds_rate_range check (tds_rate_bp is null or tds_rate_bp between 0 and 10000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_tds_nonnegative') then
    alter table public.invoices add constraint invoices_tds_nonnegative check (tds_paise >= 0);
  end if;
end $$;

create index if not exists payments_user_tds_idx on public.payments (user_id, paid_on desc) where tds_paise > 0 and deleted_at is null;
create index if not exists payments_user_tds_section_idx on public.payments (user_id, tds_section) where tds_paise > 0 and deleted_at is null;
create index if not exists invoices_user_due_idx on public.invoices (user_id, due_date);

-- ---------------------------------------------------------------------------
-- The invoice money trigger: settled = Σ(amount + TDS) of live payments.
-- ---------------------------------------------------------------------------
create or replace function private.invoice_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid    bigint;
  v_tds     bigint;
  v_paid_on date;
  v_before  text;
  v_after   text;
begin
  select coalesce(sum(p.amount_paise + p.tds_paise), 0), coalesce(sum(p.tds_paise), 0) into v_paid, v_tds
  from public.payments p
  where p.invoice_id = new.id and p.deleted_at is null;

  new.amount_paid := v_paid;
  new.tds_paise := v_tds;

  if v_paid > 0 then
    if new.status in ('void', 'draft') then
      perform private.fail('HAS_PAYMENTS');
    end if;
    if new.total < v_paid then
      perform private.fail('TOTAL_BELOW_PAID', v_paid::text);
    end if;
    if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id then
      perform private.fail('CLIENT_LOCKED');
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
    -- the payment that took the running settled total to the invoice total
    select s.paid_on into v_paid_on
    from (
      select p.paid_on, sum(p.amount_paise + p.tds_paise) over (order by p.paid_on, p.created_at, p.id) as running
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

-- backfill: existing rows pick up tds_paise (0) through the trigger's own rules
update public.invoices i set tds_paise = coalesce((select sum(p.tds_paise) from public.payments p where p.invoice_id = i.id and p.deleted_at is null), 0)
where i.tds_paise is distinct from coalesce((select sum(p.tds_paise) from public.payments p where p.invoice_id = i.id and p.deleted_at is null), 0);

-- ---------------------------------------------------------------------------
-- Results and input checks
-- ---------------------------------------------------------------------------
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
      'id', i.id, 'number', i.number, 'total', i.total, 'amount_paid', i.amount_paid, 'tds_paise', i.tds_paise,
      'balance_due', i.balance_due, 'status', i.status, 'payment_state', i.payment_state, 'paid_at', i.paid_at
    )
  )
  from public.payments p
  join public.receipts r on r.payment_id = p.id
  join public.invoices i on i.id = p.invoice_id
  where p.id = p_payment_id
$$;

revoke all on function private.payment_result(uuid) from public, anon, authenticated;

create or replace function private.check_tds_input(p_amount bigint, p_tds bigint, p_section text, p_rate_bp int)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_amount is null or p_amount < 0 or p_tds is null or p_tds < 0 or p_amount + p_tds <= 0 then perform private.fail('INVALID_AMOUNT'); end if;
  if p_tds > 0 and nullif(pg_catalog.btrim(coalesce(p_section, '')), '') is null then perform private.fail('TDS_SECTION_REQUIRED'); end if;
  if char_length(coalesce(p_section, '')) > 40 then perform private.fail('INVALID_INPUT', 'tds_section'); end if;
  if p_rate_bp is not null and (p_rate_bp < 0 or p_rate_bp > 10000) then perform private.fail('INVALID_INPUT', 'tds_rate'); end if;
end;
$$;

revoke all on function private.check_tds_input(bigint, bigint, text, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- record_payment, now with optional TDS. Callers that don't send TDS work as
-- before (the defaults), so the function is replaced rather than overloaded.
-- ---------------------------------------------------------------------------
drop function if exists public.record_payment(text, bigint, date, public.payment_mode, text, text, uuid);

create or replace function public.record_payment(
  p_invoice_id      text,
  p_amount_paise    bigint,
  p_paid_on         date,
  p_mode            public.payment_mode,
  p_reference       text,
  p_note            text,
  p_idempotency_key uuid,
  p_tds_paise       bigint default 0,
  p_tds_section     text default null,
  p_tds_rate_bp     int default null
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
  v_tds     bigint := coalesce(p_tds_paise, 0);
  v_section text := case when coalesce(p_tds_paise, 0) > 0 then nullif(pg_catalog.btrim(p_tds_section), '') end;
  v_rate    int := case when coalesce(p_tds_paise, 0) > 0 then p_tds_rate_bp end;
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
  perform private.check_tds_input(p_amount_paise, v_tds, p_tds_section, p_tds_rate_bp);
  perform private.check_payment_input(greatest(p_amount_paise + v_tds, 1), p_paid_on, v_ref, v_note);
  if p_amount_paise + v_tds > v_inv.balance_due then perform private.fail('OVERPAYMENT', v_inv.balance_due::text); end if;

  insert into public.payments (user_id, invoice_id, client_id, amount_paise, tds_paise, tds_section, tds_rate_bp, paid_on, mode, reference, note, idempotency_key, created_by)
  values (v_uid, v_inv.id, v_inv.client_id, p_amount_paise, v_tds, v_section, v_rate, p_paid_on, p_mode, v_ref, v_note, p_idempotency_key, v_uid)
  returning * into v_payment;

  v_receipt := private.create_receipt(v_payment);

  -- the trigger recomputes settled, TDS, status and paid date
  update public.invoices set updated_at = pg_catalog.now() where id = v_inv.id;

  perform private.log_activity(v_uid, 'payment', v_payment.id::text, v_inv.id, v_inv.client_id, 'payment.recorded',
    pg_catalog.jsonb_build_object('amount_paise', p_amount_paise, 'tds_paise', v_tds, 'tds_section', v_section, 'mode', p_mode, 'reference', v_ref,
      'paid_on', p_paid_on, 'receipt_number', v_receipt.number, 'invoice_number', v_inv.number));
  perform private.log_activity(v_uid, 'receipt', v_receipt.id::text, v_inv.id, v_inv.client_id, 'receipt.created',
    pg_catalog.jsonb_build_object('number', v_receipt.number, 'amount_paise', p_amount_paise, 'tds_paise', v_tds));

  return private.payment_result(v_payment.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- update_payment: TDS parameters are optional; null keeps the payment's TDS.
-- ---------------------------------------------------------------------------
drop function if exists public.update_payment(uuid, bigint, date, public.payment_mode, text, text);

create or replace function public.update_payment(
  p_payment_id   uuid,
  p_amount_paise bigint,
  p_paid_on      date,
  p_mode         public.payment_mode,
  p_reference    text,
  p_note         text,
  p_tds_paise    bigint default null,
  p_tds_section  text default null,
  p_tds_rate_bp  int default null
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
  v_tds     bigint;
  v_section text;
  v_rate    int;
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

  if p_tds_paise is null then
    v_tds := v_old.tds_paise; v_section := v_old.tds_section; v_rate := v_old.tds_rate_bp;
  else
    v_tds := p_tds_paise;
    v_section := case when p_tds_paise > 0 then nullif(pg_catalog.btrim(p_tds_section), '') end;
    v_rate := case when p_tds_paise > 0 then p_tds_rate_bp end;
  end if;

  perform private.check_tds_input(p_amount_paise, v_tds, v_section, v_rate);
  perform private.check_payment_input(greatest(p_amount_paise + v_tds, 1), p_paid_on, v_ref, v_note);
  if p_amount_paise + v_tds > v_inv.balance_due + v_old.amount_paise + v_old.tds_paise then
    perform private.fail('OVERPAYMENT', (v_inv.balance_due + v_old.amount_paise + v_old.tds_paise)::text);
  end if;

  if v_old.amount_paise <> p_amount_paise then
    v_before := v_before || pg_catalog.jsonb_build_object('amount_paise', v_old.amount_paise);
    v_after := v_after || pg_catalog.jsonb_build_object('amount_paise', p_amount_paise);
  end if;
  if v_old.tds_paise <> v_tds then
    v_before := v_before || pg_catalog.jsonb_build_object('tds_paise', v_old.tds_paise);
    v_after := v_after || pg_catalog.jsonb_build_object('tds_paise', v_tds);
  end if;
  if v_old.tds_section is distinct from v_section then
    v_before := v_before || pg_catalog.jsonb_build_object('tds_section', v_old.tds_section);
    v_after := v_after || pg_catalog.jsonb_build_object('tds_section', v_section);
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
     set amount_paise = p_amount_paise, tds_paise = v_tds, tds_section = v_section, tds_rate_bp = v_rate,
         tds_certificate_received = case when v_tds = 0 then false else tds_certificate_received end,
         paid_on = p_paid_on, mode = p_mode, reference = v_ref, note = v_note, updated_by = v_uid
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

-- ---------------------------------------------------------------------------
-- delete_payment: unchanged rules; the log now carries the TDS part too.
-- ---------------------------------------------------------------------------
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
    pg_catalog.jsonb_build_object('amount_paise', v_pay.amount_paise, 'tds_paise', v_pay.tds_paise, 'reason', v_reason, 'receipt_number', v_receipt.number, 'invoice_number', v_inv.number));
  perform private.log_activity(v_uid, 'receipt', v_receipt.id::text, v_inv.id, v_inv.client_id, 'receipt.voided',
    pg_catalog.jsonb_build_object('number', v_receipt.number, 'reason', v_reason));

  return private.payment_result(p_payment_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- TDS certificates (Form 16A) received: bulk toggle, logged per payment.
-- ---------------------------------------------------------------------------
create or replace function public.set_tds_certificate(p_payment_ids uuid[], p_received boolean)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n   int := 0;
  r     public.payments;
begin
  if v_uid is null then perform private.fail('FORBIDDEN'); end if;
  if p_payment_ids is null or cardinality(p_payment_ids) = 0 or cardinality(p_payment_ids) > 500 or p_received is null then perform private.fail('INVALID_INPUT', 'payment_ids'); end if;
  for r in
    update public.payments
       set tds_certificate_received = p_received, updated_by = v_uid
     where user_id = v_uid and id = any (p_payment_ids) and deleted_at is null and tds_paise > 0 and tds_certificate_received <> p_received
    returning *
  loop
    v_n := v_n + 1;
    perform private.log_activity(v_uid, 'payment', r.id::text, r.invoice_id, r.client_id,
      case when p_received then 'payment.tds_certificate_received' else 'payment.tds_certificate_cleared' end,
      pg_catalog.jsonb_build_object('tds_paise', r.tds_paise, 'tds_section', r.tds_section));
  end loop;
  return v_n;
end;
$$;

-- exports the app logs
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
  if p_action not in ('payments.exported', 'statement.exported', 'tds.exported', 'invoices.exported') then perform private.fail('INVALID_INPUT', 'action'); end if;
  perform private.log_activity(v_uid, 'export', p_action, null, coalesce(p_data ->> 'client_id', null), p_action, coalesce(p_data, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Public receipt: the TDS part, and "settled before" counts TDS too.
-- ---------------------------------------------------------------------------
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
    'payment', pg_catalog.jsonb_build_object('id', p.id, 'amount_paise', p.amount_paise, 'tds_paise', p.tds_paise, 'tds_section', p.tds_section,
      'paid_on', p.paid_on, 'mode', p.mode, 'reference', p.reference, 'created_at', p.created_at),
    'invoice', (i.data - 'internalNote') || pg_catalog.jsonb_build_object('status', i.status, 'total', i.total),
    'invoice_link', case when i.link_active and i.status <> 'void' then i.public_token end,
    'paid_before', coalesce((
      select sum(o.amount_paise + o.tds_paise) from public.payments o
      where o.invoice_id = p.invoice_id and o.deleted_at is null and o.id <> p.id
        and (o.paid_on, o.created_at, o.id) < (p.paid_on, p.created_at, p.id)
    ), 0)
  )
  from public.receipts r
  join public.payments p on p.id = r.payment_id
  join public.invoices i on i.id = r.invoice_id
  where r.public_token = p_token and r.link_active and r.status = 'active'
$$;

-- ---------------------------------------------------------------------------
-- Overview: "collected" is what was settled (received + TDS).
-- ---------------------------------------------------------------------------
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
    select p.amount_paise + p.tds_paise as settled, p.paid_on
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
    'collected_month',      (select coalesce(sum(settled), 0) from pay where paid_on >= date_trunc('month', p_today::timestamp)::date and paid_on <= p_today),
    'collected_last_month', (select coalesce(sum(settled), 0) from pay where paid_on < date_trunc('month', p_today::timestamp)::date),
    'avg_days_to_pay',      (select round(avg(days)) from speed),
    'avg_days_sample',      (select count(*) from speed),
    'invoiced_month',       coalesce(sum(total) filter (where status not in ('draft', 'void') and issue_date >= date_trunc('month', p_today::timestamp)::date), 0),
    'invoiced_month_count', count(*) filter (where status not in ('draft', 'void') and issue_date >= date_trunc('month', p_today::timestamp)::date)
  )
  from mine
$$;

-- ---------------------------------------------------------------------------
-- Read models: TDS columns appended (existing columns keep their order).
-- ---------------------------------------------------------------------------
create or replace view public.payment_rows with (security_invoker = true) as
  select
    p.id, p.user_id, p.invoice_id, p.client_id, p.amount_paise, p.paid_on, p.mode, p.reference, p.note, p.source,
    p.created_at, p.created_by, p.updated_at, p.deleted_at,
    i.number as invoice_number, i.issue_date as invoice_date, i.total as invoice_total, i.status as invoice_status,
    coalesce(i.client_name, '') as client_name, i.data -> 'billTo' ->> 'gstin' as client_gstin,
    r.id as receipt_id, r.number as receipt_number, r.status as receipt_status, r.revision as receipt_revision, r.emailed_at as receipt_emailed_at,
    p.tds_paise, p.tds_section, p.tds_rate_bp, p.tds_certificate_received,
    coalesce(c.pan, nullif(substr(i.data -> 'billTo' ->> 'gstin', 3, 10), '')) as client_pan
  from public.payments p
  join public.invoices i on i.id = p.invoice_id
  left join public.receipts r on r.payment_id = p.id
  left join public.clients c on c.user_id = p.user_id and c.id = p.client_id;

create or replace view public.receipt_rows with (security_invoker = true) as
  select
    r.id, r.user_id, r.number, r.receipt_date, r.revision, r.status, r.public_token, r.link_active, r.emailed_at, r.email_count,
    r.voided_at, r.void_reason, r.created_at, r.invoice_id, r.client_id, r.payment_id,
    p.amount_paise, p.mode, p.reference, p.paid_on,
    i.number as invoice_number, coalesce(i.client_name, '') as client_name,
    p.tds_paise, p.tds_section
  from public.receipts r
  join public.payments p on p.id = r.payment_id
  join public.invoices i on i.id = r.invoice_id;

revoke all on public.payment_rows, public.receipt_rows from anon, authenticated;
grant select on public.payment_rows, public.receipt_rows to authenticated;

-- Totals for the Payments page: received, TDS and settled, with a "has TDS" filter.
drop function if exists public.payment_summary(date, date, text[], public.payment_mode[], text);

create or replace function public.payment_summary(
  p_from    date,
  p_to      date,
  p_clients text[] default null,
  p_modes   public.payment_mode[] default null,
  p_q       text default null,
  p_has_tds boolean default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select v.amount_paise, v.tds_paise, v.mode
    from public.payment_rows v
    where v.deleted_at is null
      and (p_from is null or v.paid_on >= p_from)
      and (p_to is null or v.paid_on <= p_to)
      and (p_clients is null or v.client_id = any (p_clients))
      and (p_modes is null or v.mode = any (p_modes))
      and (p_has_tds is null or (v.tds_paise > 0) = p_has_tds)
      and (p_q is null or p_q = '' or v.reference ilike '%' || p_q || '%' or v.invoice_number ilike '%' || p_q || '%' or v.client_name ilike '%' || p_q || '%' or v.receipt_number ilike '%' || p_q || '%')
  )
  select pg_catalog.jsonb_build_object(
    'total', coalesce(sum(amount_paise), 0),
    'tds', coalesce(sum(tds_paise), 0),
    'settled', coalesce(sum(amount_paise + tds_paise), 0),
    'count', count(*),
    'by_mode', coalesce((select pg_catalog.jsonb_object_agg(mode, s) from (select mode, sum(amount_paise) s from f group by mode) m), '{}'::jsonb)
  )
  from f
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
revoke all on function public.record_payment(text, bigint, date, public.payment_mode, text, text, uuid, bigint, text, int) from public;
revoke all on function public.update_payment(uuid, bigint, date, public.payment_mode, text, text, bigint, text, int) from public;
revoke all on function public.delete_payment(uuid, text) from public;
revoke all on function public.set_tds_certificate(uuid[], boolean) from public;
revoke all on function public.note_export(text, jsonb) from public;
revoke all on function public.shared_receipt(text) from public;
revoke all on function public.invoice_overview(date) from public;
revoke all on function public.payment_summary(date, date, text[], public.payment_mode[], text, boolean) from public;

grant execute on function public.record_payment(text, bigint, date, public.payment_mode, text, text, uuid, bigint, text, int) to authenticated;
grant execute on function public.update_payment(uuid, bigint, date, public.payment_mode, text, text, bigint, text, int) to authenticated;
grant execute on function public.delete_payment(uuid, text) to authenticated;
grant execute on function public.set_tds_certificate(uuid[], boolean) to authenticated;
grant execute on function public.note_export(text, jsonb) to authenticated;
grant execute on function public.shared_receipt(text) to anon, authenticated;
grant execute on function public.invoice_overview(date) to authenticated;
grant execute on function public.payment_summary(date, date, text[], public.payment_mode[], text, boolean) to authenticated;
