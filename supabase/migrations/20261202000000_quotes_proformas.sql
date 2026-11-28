-- ===========================================================================
-- Quotes (estimates) and proforma invoices.
--
-- Pre-sale documents: not tax invoices, not in GST returns, never paid
-- against. A client accepts (or declines) a quote online, and either kind
-- converts into a draft invoice (a quote can also become a proforma).
--
-- Fits this codebase: rows belong to user_id (one user = one business); ids
-- are text made by the app (the editor saves before a row exists); and, like
-- invoices, `data` holds the whole document the editor and templates use, so
-- quotes share the invoice's fields, items, tax maths and templates exactly.
-- List columns are copies of what lists and filters need.
--
-- Lines live in data.items (there is no invoice_items table), so partial
-- conversions are recorded per line id in quote_conversions.lines.
-- Additive and idempotent; the CLI applies the file as one transaction.
-- ===========================================================================

do $$ begin
  create type public.quote_kind as enum ('quote', 'proforma');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'converted', 'void');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id                  text               primary key check (id ~ '^[A-Za-z0-9_-]{1,96}$'),
  user_id             uuid               not null references auth.users (id) on delete cascade,
  kind                public.quote_kind  not null,
  number              text               not null check (char_length(number) between 1 and 40),
  revision            int                not null default 1 check (revision >= 1),
  status              public.quote_status not null default 'draft',
  client_id           text               check (char_length(client_id) <= 64),
  client_name         text               check (char_length(client_name) <= 200),
  issue_date          date               not null,
  valid_until         date,
  currency            text               not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  title               text               check (char_length(title) <= 40),
  reference           text               check (char_length(reference) <= 120),
  taxable_paise       bigint             not null default 0 check (taxable_paise >= 0),
  tax_paise           bigint             not null default 0 check (tax_paise >= 0),
  total_paise         bigint             not null default 0 check (total_paise >= 0),
  converted_paise     bigint             not null default 0 check (converted_paise >= 0),
  converted_to_type   text               check (converted_to_type in ('invoice', 'proforma')),
  converted_to_id     text               check (char_length(converted_to_id) <= 96),
  source_quote_id     text               references public.quotes (id),   -- a proforma made from a quote
  missing_fields      smallint           not null default 0 check (missing_fields >= 0),
  template_id         text               check (char_length(template_id) <= 40),
  data                jsonb              not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 15000000),
  item_names          text               generated always as (lower(left(jsonb_path_query_array(data, '$.items[*].name')::text, 2000))) stored,  -- search by item
  sent_at             timestamptz,
  viewed_at           timestamptz,
  responded_at        timestamptz,
  response_action     text               check (response_action in ('accepted', 'declined')),
  response_by         text               check (response_by in ('client', 'owner')),
  response_name       text               check (char_length(response_name) <= 100),
  response_comment    text               check (char_length(response_comment) <= 1000),
  response_ip         inet,
  response_user_agent text               check (char_length(response_user_agent) <= 300),
  response_revision   int,
  public_token        text               unique check (public_token ~ '^[A-Za-z0-9_-]{32,96}$'),
  link_active         boolean            not null default true,
  emailed_at          timestamptz,
  reminded_at         timestamptz,
  voided_at           timestamptz,
  void_reason         text               check (char_length(void_reason) <= 200),
  idempotency_key     uuid               not null,
  created_by          uuid               references auth.users (id) on delete set null,
  created_at          timestamptz        not null default now(),
  updated_at          timestamptz        not null default now(),
  unique (user_id, kind, number),
  unique (user_id, idempotency_key),
  check (valid_until is null or valid_until >= issue_date)
);

comment on table public.quotes is 'Quotes (QT/<FY>/<NNN>) and proforma invoices (PI/<FY>/<NNN>). data holds the full document; other columns are for lists. Never deleted, only voided.';

-- Every version a client saw, kept read-only when a sent quote is revised.
create table if not exists public.quote_revisions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  quote_id    text        not null references public.quotes (id) on delete cascade,
  revision    int         not null check (revision >= 1),
  snapshot    jsonb       not null check (jsonb_typeof(snapshot) = 'object'),
  total_paise bigint      not null default 0,
  status      public.quote_status not null,
  created_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (quote_id, revision)
);

-- One row per conversion. lines = [{ "id": <line id>, "qty": <number> }].
create table if not exists public.quote_conversions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  quote_id        text        not null references public.quotes (id),
  target_type     text        not null check (target_type in ('invoice', 'proforma')),
  target_id       text        not null check (char_length(target_id) <= 96),
  lines           jsonb       not null check (jsonb_typeof(lines) = 'array'),
  amount_paise    bigint      not null check (amount_paise >= 0),
  idempotency_key uuid        not null,
  created_by      uuid        references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists quotes_user_kind_status_idx on public.quotes (user_id, kind, status);
create index if not exists quotes_user_date_idx on public.quotes (user_id, issue_date desc, created_at desc);
create index if not exists quotes_user_client_idx on public.quotes (user_id, client_id);
create index if not exists quotes_valid_until_idx on public.quotes (user_id, valid_until) where status = 'sent';
create index if not exists quotes_source_idx on public.quotes (source_quote_id) where source_quote_id is not null;
create index if not exists quote_revisions_quote_idx on public.quote_revisions (quote_id, revision);
create index if not exists quote_conversions_quote_idx on public.quote_conversions (quote_id);

-- invoices made from a quote or proforma point back at it
alter table public.invoices
  add column if not exists source_document_type text check (source_document_type in ('quote', 'proforma', 'recurring')),
  add column if not exists source_document_id text check (char_length(source_document_id) <= 96);
create index if not exists invoices_source_idx on public.invoices (user_id, source_document_id) where source_document_id is not null;

-- business settings for quotes
alter table public.workspace_settings
  add column if not exists quote_title text not null default 'Quotation' check (quote_title in ('Quotation', 'Estimate')),
  add column if not exists quote_validity_days int not null default 15 check (quote_validity_days between 1 and 365),
  add column if not exists allow_multiple_conversions boolean not null default false,
  add column if not exists auto_convert_accepted boolean not null default false,
  add column if not exists quote_expiry_reminders boolean not null default false;

alter table public.quotes enable row level security;
alter table public.quote_revisions enable row level security;
alter table public.quote_conversions enable row level security;

revoke all on public.quotes, public.quote_revisions, public.quote_conversions from anon, authenticated;
grant select on public.quotes, public.quote_revisions, public.quote_conversions to authenticated;

drop policy if exists quotes_select_own on public.quotes;
create policy quotes_select_own on public.quotes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists quote_revisions_select_own on public.quote_revisions;
create policy quote_revisions_select_own on public.quote_revisions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists quote_conversions_select_own on public.quote_conversions;
create policy quote_conversions_select_own on public.quote_conversions for select to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists quotes_touch on public.quotes;
create trigger quotes_touch before update on public.quotes for each row execute function private.touch_updated_at();

-- numbering and the activity log know about quotes and proformas
alter table public.document_sequences drop constraint if exists document_sequences_doc_type_check;
alter table public.document_sequences add constraint document_sequences_doc_type_check check (doc_type in ('receipt', 'credit_note', 'quote', 'proforma'));
alter table public.activities drop constraint if exists activities_entity_type_check;
alter table public.activities add constraint activities_entity_type_check check (entity_type in ('invoice', 'payment', 'receipt', 'client', 'export', 'credit_note', 'refund', 'quote'));

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
  values (p_user, p_doc_type, v_fy, case p_doc_type when 'receipt' then 'RCPT' when 'credit_note' then 'CN' when 'quote' then 'QT' when 'proforma' then 'PI' else upper(p_doc_type) end)
  on conflict (user_id, doc_type, fy) do nothing;

  update public.document_sequences s
     set next_value = s.next_value + 1
   where s.user_id = p_user and s.doc_type = p_doc_type and s.fy = v_fy
  returning s.prefix || '/' || s.fy || '/' || pg_catalog.lpad((s.next_value - 1)::text, s.padding, '0') into v_number;

  return v_number;
end;
$$;

revoke all on function private.next_document_number(uuid, text, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The caller's quote, locked. Not yours or missing → NOT_FOUND.
create or replace function private.lock_quote(p_id text)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotes;
begin
  if auth.uid() is null then perform private.fail('FORBIDDEN'); end if;
  select * into v_q from public.quotes q where q.id = p_id and q.user_id = auth.uid() for update;
  if not found then perform private.fail('NOT_FOUND'); end if;
  return v_q;
end;
$$;

-- What the app gets back after every write.
create or replace function private.quote_result(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', q.id, 'kind', q.kind, 'number', q.number, 'revision', q.revision, 'status', q.status,
    'sentAt', q.sent_at, 'publicToken', q.public_token, 'linkActive', q.link_active,
    'convertedToType', q.converted_to_type, 'convertedToId', q.converted_to_id, 'convertedPaise', q.converted_paise,
    'updatedAt', q.updated_at)
  from public.quotes q where q.id = p_id
$$;

-- Sending needs a client, at least one item, and (for quotes) a validity date.
create or replace function private.check_quote_sendable(p_q public.quotes)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(p_q.client_id, '') = '' then perform private.fail('QUOTE_INCOMPLETE', 'client'); end if;
  if pg_catalog.jsonb_typeof(p_q.data -> 'items') <> 'array' or pg_catalog.jsonb_array_length(p_q.data -> 'items') = 0 then
    perform private.fail('QUOTE_INCOMPLETE', 'items');
  end if;
  if p_q.kind = 'quote' and p_q.valid_until is null then perform private.fail('QUOTE_INCOMPLETE', 'validUntil'); end if;
  if p_q.valid_until is not null and p_q.valid_until < p_q.issue_date then perform private.fail('QUOTE_INCOMPLETE', 'validUntil'); end if;
end;
$$;

-- The owner's display name, for "Marked accepted by Rahul".
create or replace function private.owner_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select nullif(p.full_name, '') from public.profiles p where p.id = p_user), 'the owner')
$$;

revoke all on function private.lock_quote(text), private.quote_result(text), private.check_quote_sendable(public.quotes), private.owner_name(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- save_quote: create, or update a draft. The number comes from the series
-- (QT or PI, per financial year of the issue date) on the first save.
-- p_totals = { taxable, tax, total, missing } as worked out by the app's
-- invoice maths (lib/invoice/totals), the same as for invoices.
-- ---------------------------------------------------------------------------
create or replace function public.save_quote(p_id text, p_kind public.quote_kind, p_doc jsonb, p_totals jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_q      public.quotes;
  v_issue  date;
  v_valid  date;
  v_number text;
  v_doc    jsonb;
  v_new    boolean := false;
begin
  if v_user is null then perform private.fail('FORBIDDEN'); end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,96}$' or p_doc is null or pg_catalog.jsonb_typeof(p_doc) <> 'object' or p_idempotency_key is null then
    perform private.fail('INVALID_INPUT');
  end if;
  begin
    v_issue := (p_doc ->> 'issueDate')::date;
    v_valid := nullif(p_doc #>> '{quote,validUntil}', '')::date;
  exception when others then
    perform private.fail('INVALID_INPUT', 'dates');
  end;
  if v_issue is null then perform private.fail('INVALID_INPUT', 'issueDate'); end if;
  if v_valid is not null and v_valid < v_issue then perform private.fail('QUOTE_INCOMPLETE', 'validUntil'); end if;
  if coalesce((p_totals ->> 'total')::bigint, 0) < 0 then perform private.fail('INVALID_AMOUNT'); end if;

  select * into v_q from public.quotes q where q.id = p_id for update;
  if found and v_q.user_id <> v_user then perform private.fail('NOT_FOUND'); end if;

  if not found then
    -- a retried first save (double click, flaky network) returns the quote it already made
    select * into v_q from public.quotes q where q.user_id = v_user and q.idempotency_key = p_idempotency_key;
    if found then return private.quote_result(v_q.id) || '{"replayed": true}'::jsonb; end if;
    v_new := true;
    v_number := private.next_document_number(v_user, p_kind::text, v_issue);
  else
    if v_q.status <> 'draft' then perform private.fail('QUOTE_LOCKED', v_q.status::text); end if;
    v_number := v_q.number;
  end if;

  -- server-owned fields never come from the browser
  v_doc := (p_doc - 'publicToken' - 'sentAt' - 'linkActive')
        || pg_catalog.jsonb_build_object('id', p_id, 'number', v_number, 'status', 'draft', 'revision', coalesce(v_q.revision, 1));
  v_doc := v_doc || pg_catalog.jsonb_build_object('quote', coalesce(v_doc -> 'quote', '{}'::jsonb) || pg_catalog.jsonb_build_object('kind', coalesce(v_q.kind, p_kind)));

  if v_new then
    insert into public.quotes (id, user_id, kind, number, status, client_id, client_name, issue_date, valid_until, currency, title, reference,
                               taxable_paise, tax_paise, total_paise, missing_fields, template_id, data, idempotency_key, created_by)
    values (p_id, v_user, p_kind, v_number, 'draft', nullif(p_doc ->> 'clientId', ''), left(nullif(p_doc #>> '{billTo,name}', ''), 200), v_issue, v_valid,
            coalesce(nullif(p_doc ->> 'currency', ''), 'INR'), left(p_doc #>> '{quote,title}', 40), left(nullif(p_doc ->> 'reference', ''), 120),
            greatest(coalesce((p_totals ->> 'taxable')::bigint, 0), 0), greatest(coalesce((p_totals ->> 'tax')::bigint, 0), 0), coalesce((p_totals ->> 'total')::bigint, 0),
            greatest(coalesce((p_totals ->> 'missing')::int, 0), 0), left(p_doc ->> 'templateId', 40), v_doc, p_idempotency_key, v_user);
    perform private.log_activity(v_user, 'quote', p_id, null, nullif(p_doc ->> 'clientId', ''), 'quote.created', pg_catalog.jsonb_build_object('kind', p_kind, 'number', v_number));
  else
    update public.quotes q set
      client_id = nullif(p_doc ->> 'clientId', ''),
      client_name = left(nullif(p_doc #>> '{billTo,name}', ''), 200),
      issue_date = v_issue,
      valid_until = v_valid,
      currency = coalesce(nullif(p_doc ->> 'currency', ''), 'INR'),
      title = left(p_doc #>> '{quote,title}', 40),
      reference = left(nullif(p_doc ->> 'reference', ''), 120),
      taxable_paise = greatest(coalesce((p_totals ->> 'taxable')::bigint, 0), 0),
      tax_paise = greatest(coalesce((p_totals ->> 'tax')::bigint, 0), 0),
      total_paise = coalesce((p_totals ->> 'total')::bigint, 0),
      missing_fields = greatest(coalesce((p_totals ->> 'missing')::int, 0), 0),
      template_id = left(p_doc ->> 'templateId', 40),
      data = v_doc
    where q.id = p_id;
  end if;
  return private.quote_result(p_id) || pg_catalog.jsonb_build_object('created', v_new);
end;
$$;

-- ---------------------------------------------------------------------------
-- send_quote: draft → sent (or a re-send). Makes the public link.
-- p_via: 'email' | 'link' | 'whatsapp' | 'manual'.
-- ---------------------------------------------------------------------------
create or replace function public.send_quote(p_id text, p_via text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q   public.quotes := private.lock_quote(p_id);
  v_tok text;
begin
  if p_via not in ('email', 'link', 'whatsapp', 'manual') then perform private.fail('INVALID_INPUT'); end if;
  if v_q.status = 'void' then perform private.fail('QUOTE_VOID'); end if;
  if v_q.status not in ('draft', 'sent') then perform private.fail('QUOTE_LOCKED', v_q.status::text); end if;
  perform private.check_quote_sendable(v_q);
  v_tok := coalesce(v_q.public_token, private.random_token());
  update public.quotes q set
    status = 'sent',
    sent_at = case when v_q.status = 'draft' then now() else coalesce(q.sent_at, now()) end,
    public_token = v_tok,
    link_active = true,
    emailed_at = case when p_via = 'email' then now() else q.emailed_at end,
    data = q.data || pg_catalog.jsonb_build_object('status', 'sent')
  where q.id = p_id;
  perform private.log_activity(v_q.user_id, 'quote', p_id, null, v_q.client_id, case when v_q.status = 'draft' then 'quote.sent' else 'quote.resent' end,
    pg_catalog.jsonb_build_object('via', p_via, 'revision', v_q.revision, 'number', v_q.number));
  return private.quote_result(p_id);
end;
$$;

-- The public link without sending (Copy link, WhatsApp). Turning it off hides the page.
create or replace function public.quote_share_link(p_id text, p_active boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotes := private.lock_quote(p_id);
begin
  update public.quotes q set
    public_token = coalesce(q.public_token, private.random_token()),
    link_active = coalesce(p_active, q.link_active)
  where q.id = p_id;
  return private.quote_result(p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- revise_quote: keep the version the client saw, open the next revision as a
-- draft (it must be sent again). An accepted quote needs p_confirm.
-- ---------------------------------------------------------------------------
create or replace function public.revise_quote(p_id text, p_confirm boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotes := private.lock_quote(p_id);
begin
  if v_q.status = 'draft' then return private.quote_result(p_id); end if;
  if v_q.status = 'void' then perform private.fail('QUOTE_VOID'); end if;
  if v_q.status = 'converted' then perform private.fail('ALREADY_CONVERTED'); end if;
  if v_q.status = 'accepted' and not coalesce(p_confirm, false) then perform private.fail('CONFIRM_REQUIRED'); end if;

  insert into public.quote_revisions (user_id, quote_id, revision, snapshot, total_paise, status, created_by)
  values (v_q.user_id, v_q.id, v_q.revision,
          v_q.data || pg_catalog.jsonb_build_object('status', v_q.status, 'sentAt', v_q.sent_at, 'respondedAt', v_q.responded_at,
                                                    'responseAction', v_q.response_action, 'responseName', v_q.response_name, 'responseComment', v_q.response_comment),
          v_q.total_paise, v_q.status, auth.uid())
  on conflict (quote_id, revision) do nothing;

  update public.quotes q set
    revision = v_q.revision + 1,
    status = 'draft',
    viewed_at = null,
    responded_at = null, response_action = null, response_by = null, response_name = null, response_comment = null,
    response_ip = null, response_user_agent = null, response_revision = null,
    data = q.data || pg_catalog.jsonb_build_object('status', 'draft', 'revision', v_q.revision + 1)
  where q.id = p_id;
  perform private.log_activity(v_q.user_id, 'quote', p_id, null, v_q.client_id, 'quote.revised',
    pg_catalog.jsonb_build_object('from', v_q.revision, 'to', v_q.revision + 1, 'was', v_q.status, 'number', v_q.number));
  return private.quote_result(p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Converting: one private routine shared by the app (convert_quote, which
-- passes the new document and its total from the invoice maths) and by
-- auto-convert on acceptance (a full copy, whose total is the quote's).
-- ---------------------------------------------------------------------------

-- Remaining quantity per line id: quoted qty minus what's been converted.
create or replace function private.quote_remaining(p_q public.quotes)
returns table (line_id text, qty numeric, remaining numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with done as (
    select l ->> 'id' as line_id, sum((l ->> 'qty')::numeric) as qty
    from public.quote_conversions c, pg_catalog.jsonb_array_elements(c.lines) l
    where c.quote_id = p_q.id
    group by 1
  )
  select it ->> 'id', (it ->> 'qty')::numeric, (it ->> 'qty')::numeric - coalesce(d.qty, 0)
  from pg_catalog.jsonb_array_elements(p_q.data -> 'items') it
  left join done d on d.line_id = it ->> 'id'
$$;

-- Due date for a new invoice: today + the payment terms (custom keeps the quote's gap, else 15 days).
create or replace function private.due_from_terms(p_doc jsonb, p_today date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_today + case p_doc ->> 'paymentTerms'
    when 'due_on_receipt' then 0 when 'net_7' then 7 when 'net_15' then 15 when 'net_30' then 30 when 'net_45' then 45 when 'net_60' then 60
    else coalesce(greatest(nullif(p_doc ->> 'dueDate', '')::date - nullif(p_doc ->> 'issueDate', '')::date, 0), 15) end
$$;

-- A full copy of a quote as a new draft invoice (or proforma) document.
create or replace function private.quote_to_document(p_q public.quotes, p_target text, p_new_id text, p_today date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when p_target = 'invoice' then
      (p_q.data - 'quote' - 'publicToken' - 'sentAt')
      || pg_catalog.jsonb_build_object(
           'id', p_new_id, 'number', '', 'status', 'draft', 'revision', 1, 'linkActive', true,
           'issueDate', p_today, 'dueDate', private.due_from_terms(p_q.data, p_today),
           'title', case when coalesce(p_q.data #>> '{from,gstin}', '') <> '' then 'Tax Invoice' else 'Bill of Supply' end,
           'payment', coalesce(p_q.data -> 'payment', '{}'::jsonb) || '{"amountPaid": 0}'::jsonb,
           'source', pg_catalog.jsonb_build_object('type', p_q.kind, 'id', p_q.id, 'number', p_q.number))
    else
      (p_q.data - 'publicToken' - 'sentAt')
      || pg_catalog.jsonb_build_object(
           'id', p_new_id, 'status', 'draft', 'revision', 1, 'linkActive', true, 'issueDate', p_today,
           'quote', pg_catalog.jsonb_build_object('kind', 'proforma', 'title', 'Proforma Invoice', 'validUntil', null),
           'source', pg_catalog.jsonb_build_object('type', p_q.kind, 'id', p_q.id, 'number', p_q.number))
    end
$$;

create or replace function private.convert_quote(p_q public.quotes, p_target text, p_lines jsonb, p_doc jsonb, p_total bigint, p_missing int, p_new_id text, p_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_multi  boolean;
  v_today  date := private.today_ist();
  v_lines  jsonb := p_lines;
  v_bad    int;
  v_number text;
begin
  if p_target not in ('invoice', 'proforma') or (p_q.kind = 'proforma' and p_target <> 'invoice') then perform private.fail('INVALID_TARGET'); end if;
  if p_q.status = 'void' then perform private.fail('QUOTE_VOID'); end if;
  if p_q.status = 'declined' then perform private.fail('QUOTE_DECLINED'); end if;
  if p_new_id is null or p_new_id !~ '^[A-Za-z0-9_-]{1,96}$' or p_doc is null or p_doc ->> 'id' is distinct from p_new_id then perform private.fail('INVALID_INPUT'); end if;
  if p_total is null or p_total < 0 then perform private.fail('INVALID_AMOUNT'); end if;
  if pg_catalog.jsonb_typeof(p_q.data -> 'items') <> 'array' or pg_catalog.jsonb_array_length(p_q.data -> 'items') = 0 then perform private.fail('QUOTE_INCOMPLETE', 'items'); end if;

  select coalesce(ws.allow_multiple_conversions, false) into v_multi from public.workspace_settings ws where ws.user_id = p_q.user_id;
  v_multi := coalesce(v_multi, false);
  if p_q.status = 'converted' and not v_multi then perform private.fail('ALREADY_CONVERTED'); end if;

  -- what's converted: everything left, unless multiple conversions pick lines
  if v_lines is null or not v_multi then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', r.line_id, 'qty', r.remaining)), '[]'::jsonb) into v_lines
    from private.quote_remaining(p_q) r where r.remaining > 0;
  end if;
  if pg_catalog.jsonb_typeof(v_lines) <> 'array' or pg_catalog.jsonb_array_length(v_lines) = 0 then perform private.fail('CONVERSION_EXCEEDS_REMAINING'); end if;

  -- each line once, quantity above zero and within what's left
  select count(*) into v_bad
  from pg_catalog.jsonb_array_elements(v_lines) l
  left join private.quote_remaining(p_q) r on r.line_id = l ->> 'id'
  where r.line_id is null or (l ->> 'qty')::numeric <= 0 or (l ->> 'qty')::numeric > r.remaining;
  if v_bad > 0 or (select count(distinct l ->> 'id') from pg_catalog.jsonb_array_elements(v_lines) l) <> pg_catalog.jsonb_array_length(v_lines) then
    perform private.fail('CONVERSION_EXCEEDS_REMAINING');
  end if;

  -- the new document carries exactly those lines and quantities
  if pg_catalog.jsonb_typeof(p_doc -> 'items') <> 'array' or pg_catalog.jsonb_array_length(p_doc -> 'items') <> pg_catalog.jsonb_array_length(v_lines) then
    perform private.fail('INVALID_INPUT', 'items');
  end if;
  select count(*) into v_bad
  from pg_catalog.jsonb_array_elements(p_doc -> 'items') it
  left join pg_catalog.jsonb_array_elements(v_lines) l on l ->> 'id' = it ->> 'id'
  where l is null or (l ->> 'qty')::numeric <> (it ->> 'qty')::numeric;
  if v_bad > 0 then perform private.fail('INVALID_INPUT', 'items'); end if;

  if p_target = 'invoice' then
    insert into public.invoices (id, user_id, number, status, client_id, client_name, issue_date, due_date, currency, total, missing_fields, template_id, data, link_active,
                                 source_document_type, source_document_id)
    values (p_new_id, p_q.user_id, '', 'draft', p_q.client_id, p_q.client_name, coalesce(nullif(p_doc ->> 'issueDate', '')::date, v_today), nullif(p_doc ->> 'dueDate', '')::date,
            p_q.currency, p_total, greatest(coalesce(p_missing, 0), 0), p_q.template_id, p_doc, true, p_q.kind::text, p_q.id);
    insert into public.invoice_events (invoice_id, user_id, type, meta) values (p_new_id, p_q.user_id, 'created', pg_catalog.jsonb_build_object('from', p_q.number));
  else
    v_number := private.next_document_number(p_q.user_id, 'proforma', v_today);
    insert into public.quotes (id, user_id, kind, number, status, client_id, client_name, issue_date, valid_until, currency, title, reference, taxable_paise, tax_paise,
                               total_paise, missing_fields, template_id, data, idempotency_key, created_by, source_quote_id)
    values (p_new_id, p_q.user_id, 'proforma', v_number, 'draft', p_q.client_id, p_q.client_name, coalesce(nullif(p_doc ->> 'issueDate', '')::date, v_today), null,
            p_q.currency, 'Proforma Invoice', p_q.reference, p_q.taxable_paise, p_q.tax_paise, p_total, greatest(coalesce(p_missing, 0), 0), p_q.template_id,
            p_doc || pg_catalog.jsonb_build_object('number', v_number), p_key, auth.uid(), p_q.id);
    perform private.log_activity(p_q.user_id, 'quote', p_new_id, null, p_q.client_id, 'quote.created', pg_catalog.jsonb_build_object('kind', 'proforma', 'number', v_number, 'from', p_q.number));
  end if;

  insert into public.quote_conversions (user_id, quote_id, target_type, target_id, lines, amount_paise, idempotency_key, created_by)
  values (p_q.user_id, p_q.id, p_target, p_new_id, v_lines, p_total, p_key, auth.uid());

  update public.quotes q set
    status = 'converted',
    converted_paise = q.converted_paise + p_total,
    converted_to_type = p_target,
    converted_to_id = p_new_id,
    data = q.data || '{"status": "converted"}'::jsonb
  where q.id = p_q.id;

  perform private.log_activity(p_q.user_id, 'quote', p_q.id, case when p_target = 'invoice' then p_new_id end, p_q.client_id, 'quote.converted',
    pg_catalog.jsonb_build_object('target', p_target, 'target_id', p_new_id, 'amount_paise', p_total, 'number', p_q.number, 'partial', v_multi and p_lines is not null));
  if p_target = 'invoice' then
    perform private.log_activity(p_q.user_id, 'invoice', p_new_id, p_new_id, p_q.client_id, 'invoice.created_from_quote',
      pg_catalog.jsonb_build_object('quote_id', p_q.id, 'number', p_q.number, 'kind', p_q.kind));
  end if;
  return pg_catalog.jsonb_build_object('targetType', p_target, 'targetId', p_new_id, 'replayed', false);
end;
$$;

revoke all on function private.quote_remaining(public.quotes), private.due_from_terms(jsonb, date), private.quote_to_document(public.quotes, text, text, date),
  private.convert_quote(public.quotes, text, jsonb, jsonb, bigint, int, text, uuid) from public, anon, authenticated;

-- p_lines: null = everything left; with multiple conversions on, [{ id, qty }].
create or replace function public.convert_quote(p_id text, p_target text, p_lines jsonb, p_doc jsonb, p_total bigint, p_missing int, p_new_id text, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q    public.quotes;
  v_prev public.quote_conversions;
begin
  if p_idempotency_key is null then perform private.fail('INVALID_INPUT'); end if;
  v_q := private.lock_quote(p_id);
  select * into v_prev from public.quote_conversions c where c.user_id = v_q.user_id and c.idempotency_key = p_idempotency_key;
  if found then return pg_catalog.jsonb_build_object('targetType', v_prev.target_type, 'targetId', v_prev.target_id, 'replayed', true); end if;
  return private.convert_quote(v_q, p_target, p_lines, p_doc, p_total, p_missing, p_new_id, p_idempotency_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- Responses
-- ---------------------------------------------------------------------------

-- From the public page only (the server route rate-limits it). Works on an
-- expired quote; the owner sees that it was accepted late.
create or replace function public.respond_to_quote(p_token text, p_action text, p_name text, p_comment text, p_ip text, p_user_agent text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q        public.quotes;
  v_name     text := nullif(pg_catalog.btrim(coalesce(p_name, '')), '');
  v_comment  text := nullif(pg_catalog.btrim(coalesce(p_comment, '')), '');
  v_status   public.quote_status;
  v_ip       inet;
  v_auto     boolean;
  v_expired  boolean;
  v_invoice  text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,96}$' then perform private.fail('LINK_INACTIVE'); end if;
  select * into v_q from public.quotes q where q.public_token = p_token for update;
  if not found or not v_q.link_active or v_q.status = 'void' then perform private.fail('LINK_INACTIVE'); end if;
  if v_q.status in ('accepted', 'declined', 'converted') then perform private.fail('ALREADY_RESPONDED', v_q.response_action); end if;
  if v_q.status <> 'sent' then perform private.fail('QUOTE_NOT_SENT'); end if;
  if p_action not in ('accept', 'decline') then perform private.fail('INVALID_INPUT'); end if;
  if p_action = 'decline' and v_q.kind = 'proforma' then perform private.fail('PROFORMA_NO_DECLINE'); end if;
  if p_action = 'accept' and (v_name is null or char_length(v_name) < 2) then perform private.fail('NAME_REQUIRED'); end if;
  if char_length(coalesce(v_name, '')) > 100 or char_length(coalesce(v_comment, '')) > 1000 then perform private.fail('INVALID_INPUT'); end if;
  begin v_ip := nullif(p_ip, '')::inet; exception when others then v_ip := null; end;

  v_status := case when p_action = 'accept' then 'accepted' else 'declined' end;
  v_expired := v_q.valid_until is not null and v_q.valid_until < private.today_ist();
  update public.quotes q set
    status = v_status,
    responded_at = now(),
    response_action = v_status::text,
    response_by = 'client',
    response_name = v_name,
    response_comment = v_comment,
    response_ip = v_ip,
    response_user_agent = left(p_user_agent, 300),
    response_revision = v_q.revision,
    data = q.data || pg_catalog.jsonb_build_object('status', v_status)
  where q.id = v_q.id
  returning * into v_q;

  perform private.log_activity(v_q.user_id, 'quote', v_q.id, null, v_q.client_id, 'quote.' || v_status::text,
    pg_catalog.jsonb_build_object('name', v_name, 'by', 'client', 'revision', v_q.revision, 'expired', v_expired, 'number', v_q.number, 'comment', left(v_comment, 200)));

  -- optional: accepted quotes become draft invoices straight away
  select coalesce(ws.auto_convert_accepted, false) into v_auto from public.workspace_settings ws where ws.user_id = v_q.user_id;
  -- (a failed conversion never blocks the client's answer: the owner converts by hand)
  if v_status = 'accepted' and coalesce(v_auto, false) then
    begin
      v_invoice := 'inv_' || left(private.random_token(), 20);
      perform private.convert_quote(v_q, 'invoice', null, private.quote_to_document(v_q, 'invoice', v_invoice, private.today_ist()), v_q.total_paise, v_q.missing_fields, v_invoice, gen_random_uuid());
    exception when others then
      v_invoice := null;
      raise notice 'auto-convert skipped for %: %', v_q.id, sqlerrm;
    end;
  end if;

  return pg_catalog.jsonb_build_object('status', v_status, 'respondedAt', v_q.responded_at, 'name', v_name, 'comment', v_comment, 'revision', v_q.revision,
                                       'expired', v_expired, 'autoConverted', v_invoice is not null);
end;
$$;

-- The owner marks a quote accepted or declined (a WhatsApp or verbal answer).
create or replace function public.set_quote_status(p_id text, p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q    public.quotes := private.lock_quote(p_id);
  v_name text := private.owner_name(auth.uid());
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('accepted', 'declined') then perform private.fail('INVALID_INPUT'); end if;
  if v_q.status = 'void' then perform private.fail('QUOTE_VOID'); end if;
  if v_q.status in ('accepted', 'declined', 'converted') then perform private.fail('ALREADY_RESPONDED', v_q.status::text); end if;
  if p_status = 'declined' and v_q.kind = 'proforma' then perform private.fail('PROFORMA_NO_DECLINE'); end if;
  if char_length(coalesce(v_note, '')) > 1000 then perform private.fail('INVALID_INPUT'); end if;
  perform private.check_quote_sendable(v_q);

  update public.quotes q set
    status = p_status::public.quote_status,
    sent_at = coalesce(q.sent_at, now()),
    responded_at = now(),
    response_action = p_status,
    response_by = 'owner',
    response_name = v_name,
    response_comment = v_note,
    response_revision = v_q.revision,
    data = q.data || pg_catalog.jsonb_build_object('status', p_status)
  where q.id = p_id;
  perform private.log_activity(v_q.user_id, 'quote', p_id, null, v_q.client_id, 'quote.marked_' || p_status,
    pg_catalog.jsonb_build_object('by_name', v_name, 'by', 'owner', 'note', left(v_note, 200), 'revision', v_q.revision, 'number', v_q.number));
  return private.quote_result(p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Void and duplicate
-- ---------------------------------------------------------------------------
create or replace function public.void_quote(p_id text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q      public.quotes := private.lock_quote(p_id);
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
begin
  if v_q.status = 'void' then return private.quote_result(p_id); end if;
  if v_q.status = 'converted' then perform private.fail('ALREADY_CONVERTED'); end if;
  if char_length(v_reason) not between 3 and 200 then perform private.fail('INVALID_REASON'); end if;
  update public.quotes q set status = 'void', voided_at = now(), void_reason = v_reason, link_active = false,
    data = q.data || '{"status": "void", "linkActive": false}'::jsonb
  where q.id = p_id;
  perform private.log_activity(v_q.user_id, 'quote', p_id, null, v_q.client_id, 'quote.voided', pg_catalog.jsonb_build_object('reason', v_reason, 'was', v_q.status, 'number', v_q.number));
  return private.quote_result(p_id);
end;
$$;

-- A new draft from any quote: new number, today's dates, nothing sent.
create or replace function public.duplicate_quote(p_id text, p_new_id text, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q      public.quotes := private.lock_quote(p_id);
  v_today  date := private.today_ist();
  v_days   int;
  v_valid  date;
  v_number text;
  v_prev   text;
begin
  if p_new_id is null or p_new_id !~ '^[A-Za-z0-9_-]{1,96}$' or p_idempotency_key is null then perform private.fail('INVALID_INPUT'); end if;
  select q.id into v_prev from public.quotes q where q.user_id = v_q.user_id and q.idempotency_key = p_idempotency_key;
  if v_prev is not null then return private.quote_result(v_prev) || '{"replayed": true}'::jsonb; end if;

  select ws.quote_validity_days into v_days from public.workspace_settings ws where ws.user_id = v_q.user_id;
  v_valid := case when v_q.kind = 'quote' then v_today + coalesce(v_days, 15)
                  when v_q.valid_until is not null then v_today + greatest(v_q.valid_until - v_q.issue_date, 0) end;
  v_number := private.next_document_number(v_q.user_id, v_q.kind::text, v_today);
  insert into public.quotes (id, user_id, kind, number, status, client_id, client_name, issue_date, valid_until, currency, title, reference, taxable_paise, tax_paise,
                             total_paise, missing_fields, template_id, data, idempotency_key, created_by)
  values (p_new_id, v_q.user_id, v_q.kind, v_number, 'draft', v_q.client_id, v_q.client_name, v_today, v_valid, v_q.currency, v_q.title, v_q.reference, v_q.taxable_paise,
          v_q.tax_paise, v_q.total_paise, v_q.missing_fields, v_q.template_id,
          (v_q.data - 'publicToken' - 'sentAt' - 'source')
            || pg_catalog.jsonb_build_object('id', p_new_id, 'number', v_number, 'status', 'draft', 'revision', 1, 'issueDate', v_today, 'linkActive', true,
                 'quote', coalesce(v_q.data -> 'quote', '{}'::jsonb) || pg_catalog.jsonb_build_object('kind', v_q.kind, 'validUntil', v_valid)),
          p_idempotency_key, auth.uid());
  perform private.log_activity(v_q.user_id, 'quote', p_new_id, null, v_q.client_id, 'quote.created', pg_catalog.jsonb_build_object('kind', v_q.kind, 'number', v_number, 'duplicate_of', v_q.number));
  return private.quote_result(p_new_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public page: the latest revision behind a token. While a new revision is
-- being drafted the client keeps seeing the last one that was sent.
-- Internal ids and the private note are left out.
-- ---------------------------------------------------------------------------
create or replace function public.shared_quote(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q    public.quotes;
  v_doc  jsonb;
  v_rev  int;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,96}$' then return null; end if;
  select * into v_q from public.quotes q where q.public_token = p_token and q.link_active and q.status <> 'void';
  if not found then return null; end if;
  v_doc := v_q.data;
  v_rev := v_q.revision;
  if v_q.status = 'draft' then
    select r.snapshot, r.revision into v_doc, v_rev from public.quote_revisions r where r.quote_id = v_q.id order by r.revision desc limit 1;
    if v_doc is null then return null; end if;   -- never sent
  end if;
  v_doc := (v_doc - 'internalNote' - 'clientId' - 'attachments' - 'respondedAt' - 'responseAction' - 'responseName' - 'responseComment')
        || pg_catalog.jsonb_build_object('id', 'shared', 'items', coalesce((select pg_catalog.jsonb_agg(it - 'catalogItemId') from pg_catalog.jsonb_array_elements(v_doc -> 'items') it), '[]'::jsonb));
  return pg_catalog.jsonb_build_object(
    'document', v_doc,
    'kind', v_q.kind,
    'number', v_q.number,
    'revision', v_rev,
    'status', case when v_q.status = 'draft' then 'revising' else v_q.status::text end,
    'validUntil', v_q.valid_until,
    'expired', v_q.status = 'sent' and v_q.valid_until is not null and v_q.valid_until < private.today_ist(),
    'response', case when v_q.responded_at is null then null else pg_catalog.jsonb_build_object(
      'action', v_q.response_action, 'name', case when v_q.response_by = 'client' then v_q.response_name end, 'comment', case when v_q.response_by = 'client' then v_q.response_comment end,
      'at', v_q.responded_at, 'by', v_q.response_by) end);
end;
$$;

-- The client opened the link: the first view marks a sent quote as viewed.
create or replace function public.track_shared_quote(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_q public.quotes;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,96}$' then return null; end if;
  select * into v_q from public.quotes q where q.public_token = p_token and q.link_active and q.status <> 'void' for update;
  if not found then return null; end if;
  if v_q.viewed_at is not null or v_q.status <> 'sent' then return false; end if;
  update public.quotes q set viewed_at = now() where q.id = v_q.id;
  perform private.log_activity(v_q.user_id, 'quote', v_q.id, null, v_q.client_id, 'quote.viewed', pg_catalog.jsonb_build_object('revision', v_q.revision, 'number', v_q.number));
  return true;
end;
$$;

revoke all on function
  public.save_quote(text, public.quote_kind, jsonb, jsonb, uuid),
  public.send_quote(text, text),
  public.quote_share_link(text, boolean),
  public.revise_quote(text, boolean),
  public.convert_quote(text, text, jsonb, jsonb, bigint, int, text, uuid),
  public.respond_to_quote(text, text, text, text, text, text),
  public.set_quote_status(text, text, text),
  public.void_quote(text, text),
  public.duplicate_quote(text, text, uuid),
  public.shared_quote(text),
  public.track_shared_quote(text)
from public, anon, authenticated;

grant execute on function
  public.save_quote(text, public.quote_kind, jsonb, jsonb, uuid),
  public.send_quote(text, text),
  public.quote_share_link(text, boolean),
  public.revise_quote(text, boolean),
  public.convert_quote(text, text, jsonb, jsonb, bigint, int, text, uuid),
  public.set_quote_status(text, text, text),
  public.void_quote(text, text),
  public.duplicate_quote(text, text, uuid)
to authenticated;
grant execute on function public.respond_to_quote(text, text, text, text, text, text), public.shared_quote(text), public.track_shared_quote(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Daily job (with the 00:10 IST overdue job): log quote.expired once per
-- quote, and give each owner an in-app digest of yesterday's acceptances.
-- ---------------------------------------------------------------------------
create or replace function private.quote_daily()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today   date := private.today_ist();
  v_expired int;
begin
  with gone as (
    insert into public.activities (user_id, entity_type, entity_id, client_id, action, data)
    select q.user_id, 'quote', q.id, q.client_id, 'quote.expired', pg_catalog.jsonb_build_object('valid_until', q.valid_until, 'number', q.number, 'revision', q.revision)
    from public.quotes q
    where q.status = 'sent' and q.valid_until < v_today
      and not exists (select 1 from public.activities a where a.user_id = q.user_id and a.entity_type = 'quote' and a.entity_id = q.id and a.action = 'quote.expired'
                        and (a.data ->> 'revision')::int = q.revision)
    returning 1
  )
  select count(*)::int into v_expired from gone;

  insert into public.activities (user_id, entity_type, entity_id, action, data)
  select q.user_id, 'quote', 'digest-' || (v_today - 1)::text, 'quote.accepted_digest',
         pg_catalog.jsonb_build_object('date', v_today - 1, 'count', count(*), 'total_paise', sum(q.total_paise), 'numbers', pg_catalog.jsonb_agg(q.number order by q.responded_at))
  from public.quotes q
  where q.response_action = 'accepted' and (q.responded_at at time zone 'Asia/Kolkata')::date = v_today - 1
    and not exists (select 1 from public.activities a where a.user_id = q.user_id and a.entity_type = 'quote' and a.entity_id = 'digest-' || (v_today - 1)::text)
  group by q.user_id;

  return v_expired;
end;
$$;

revoke all on function private.quote_daily() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('prettybills-overdue', '40 18 * * *', 'select private.log_newly_overdue(); select private.quote_daily();'); -- 18:40 UTC = 00:10 IST
  end if;
exception when others then
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;
