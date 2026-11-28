-- ===========================================================================
-- Dashboard in one round trip.
--
-- Before: ~11 queries in 3 sequential rounds (overview, insights ×3, every
-- invoice, a year of payments, two activity feeds, client credit, quotes
-- awaiting). After: one call that returns all of it as JSON.
--
--   private.invoice_overview_for(user, today)  the headline numbers (one copy
--                                               of the logic; invoice_overview
--                                               and the dashboard both use it)
--   private.dashboard_for(user, today)         everything the dashboard reads
--   public.dashboard_data(today)               signed-in users: their own data
--   public.dashboard_data_for(user, today)     service role only, for the
--                                               server cache (keyed by user)
--
-- Every query filters by the user explicitly, so the service-role variant is
-- as isolated as the RLS one. Plus two indexes the lists were missing.
-- Additive; the CLI applies the file as one transaction.
-- ===========================================================================

-- the "All" invoices list sorts by issue date with no status filter
create index if not exists invoices_user_issue_idx on public.invoices (user_id, issue_date desc, created_at desc);
-- the dashboard's payment activity feed (payment.recorded / payment.deleted)
create index if not exists activities_user_action_idx on public.activities (user_id, action, created_at desc);

-- ---------------------------------------------------------------------------
-- Overview numbers for one user (was the body of public.invoice_overview).
-- ---------------------------------------------------------------------------
create or replace function private.invoice_overview_for(p_user uuid, p_today date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select
      i.status, i.total, i.balance_due, i.missing_fields, i.paid_at, i.issue_date, i.due_date,
      (i.status in ('sent', 'viewed', 'partially_paid')) as open,
      (i.status in ('sent', 'viewed', 'partially_paid') and i.due_date < p_today and i.balance_due > 0) as late
    from public.invoices i
    where i.user_id = p_user
  ),
  pay as (
    select p.amount_paise + p.tds_paise as settled, p.paid_on
    from public.payments p
    where p.user_id = p_user and p.deleted_at is null
      and p.paid_on >= (date_trunc('month', p_today::timestamp) - interval '1 month')::date
  ),
  speed as (
    select greatest(0, ((i.paid_at at time zone 'Asia/Kolkata')::date - i.issue_date)) as days
    from public.invoices i
    where i.user_id = p_user and i.status = 'paid' and i.paid_at is not null
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

-- same result as before, for the caller only
create or replace function public.invoice_overview(p_today date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then null else private.invoice_overview_for((select auth.uid()), p_today) end
$$;

-- ---------------------------------------------------------------------------
-- Everything the dashboard cards read, for one user.
-- invoices: list columns of every invoice (newest first, capped), from which
-- the app builds the charts, the overdue / upcoming / recent lists and the
-- weekly sparklines. payments: a year of settled amounts by mode.
-- ---------------------------------------------------------------------------
create or replace function private.dashboard_for(p_user uuid, p_today date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'overview', private.invoice_overview_for(p_user, p_today),
    'invoices', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.issue_date desc, x.created_at desc)
      from (
        select i.id, i.number, i.status, i.client_id, i.client_name, i.issue_date, i.due_date, i.currency, i.total, i.amount_paid, i.balance_due,
               i.missing_fields, i.template_id, i.public_token, i.link_active, i.sent_at, i.viewed_at, i.paid_at, i.created_at, i.updated_at,
               i.credited_paise, i.cancelled
        from public.invoices i
        where i.user_id = p_user
        order by i.issue_date desc, i.created_at desc
        limit 5000
      ) x), '[]'::jsonb),
    'payments', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('invoice_id', p.invoice_id, 'amount_paise', p.amount_paise, 'paid_on', p.paid_on, 'mode', p.mode))
      from (
        select p.invoice_id, p.amount_paise, p.paid_on, p.mode
        from public.payments p
        where p.user_id = p_user and p.deleted_at is null
          and p.paid_on >= (date_trunc('month', p_today::timestamp) - interval '11 months')::date
        order by p.paid_on
        limit 20000
      ) p), '[]'::jsonb),
    'events', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('type', e.type, 'at', e.at, 'invoice_id', e.invoice_id, 'number', e.number, 'client_name', e.client_name) order by e.at desc)
      from (
        select ev.type, ev.at, ev.invoice_id, i.number, i.client_name
        from public.invoice_events ev
        join public.invoices i on i.id = ev.invoice_id and i.user_id = p_user
        where ev.user_id = p_user and ev.type <> 'created'
        order by ev.at desc
        limit 10
      ) e), '[]'::jsonb),
    'pay_events', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', a.id, 'action', a.action, 'invoice_id', a.invoice_id, 'data', a.data, 'created_at', a.created_at) order by a.created_at desc)
      from (
        select a.id, a.action, a.invoice_id, a.data, a.created_at
        from public.activities a
        where a.user_id = p_user and a.action in ('payment.recorded', 'payment.deleted')
        order by a.created_at desc
        limit 10
      ) a), '[]'::jsonb),
    'client_credit', (select coalesce(sum(n.unapplied_paise), 0) from public.credit_notes n where n.user_id = p_user and n.status = 'issued' and n.unapplied_paise > 0),
    'quotes_awaiting', (select count(*) from public.quotes q where q.user_id = p_user and q.status = 'sent' and (q.valid_until is null or q.valid_until >= p_today))
  )
$$;

revoke all on function private.invoice_overview_for(uuid, date), private.dashboard_for(uuid, date) from public, anon, authenticated;

-- signed in: your own dashboard, nobody else's
create or replace function public.dashboard_data(p_today date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then null else private.dashboard_for((select auth.uid()), p_today) end
$$;

-- the server cache (service role, after the app has authenticated the user)
create or replace function public.dashboard_data_for(p_user uuid, p_today date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.dashboard_for(p_user, p_today)
$$;

revoke all on function public.invoice_overview(date), public.dashboard_data(date), public.dashboard_data_for(uuid, date) from public, anon, authenticated;
grant execute on function public.invoice_overview(date), public.dashboard_data(date) to authenticated;
grant execute on function public.dashboard_data_for(uuid, date) to service_role;
