-- LCC Payroll canonical PostgreSQL schema.
-- This migration is additive and does not delete or alter the legacy MySQL source.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;
do $$ begin
  create type public.pms_app_role as enum ('admin', 'employee');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.pms_employment_status as enum ('active', 'inactive', 'on_leave', 'terminated');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.pms_salary_type as enum ('monthly', 'daily', 'hourly');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.pms_payroll_status as enum ('draft', 'processing', 'review', 'finalized', 'paid', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.pms_loan_status as enum ('active', 'completed', 'suspended', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.pms_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;
create table if not exists public.pms_profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null default '',
  avatar_path text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pms_user_roles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role public.pms_app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pms_departments (
  id uuid primary key default gen_random_uuid(),
  legacy_department_id integer unique,
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pms_positions (
  id uuid primary key default gen_random_uuid(),
  legacy_position_id integer unique,
  department_id uuid references public.pms_departments(id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, name)
);
create table if not exists public.pms_employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  legacy_employee_id integer unique,
  employee_number text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text,
  email text,
  civil_status text,
  nationality text,
  religion text,
  birth_date date,
  permanent_address text,
  present_address text,
  contact_number text,
  photo_path text,
  legacy_photo_path text,
  current_department_id uuid references public.pms_departments(id) on delete restrict,
  current_position_id uuid references public.pms_positions(id) on delete restrict,
  status public.pms_employment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_email_format check (email is null or position('@' in email) > 1)
);
create table if not exists public.pms_employee_assignments (
  id uuid primary key default gen_random_uuid(),
  legacy_assignment_id integer unique,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  department_id uuid references public.pms_departments(id) on delete restrict,
  position_id uuid references public.pms_positions(id) on delete restrict,
  start_date date not null,
  end_date date,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_dates_valid check (end_date is null or end_date >= start_date)
);
create table if not exists public.pms_employee_salary_history (
  id uuid primary key default gen_random_uuid(),
  legacy_salary_id integer unique,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  assignment_id uuid references public.pms_employee_assignments(id) on delete restrict,
  salary_type public.pms_salary_type not null,
  amount numeric(14,2) not null check (amount >= 0),
  legacy_daily_amount numeric(14,2),
  legacy_hourly_amount numeric(14,2),
  is_approved boolean not null default false,
  effective_from date not null,
  effective_to date,
  source text,
  created_at timestamptz not null default now(),
  constraint salary_dates_valid check (effective_to is null or effective_to >= effective_from)
);
create index if not exists pms_salary_history_lookup on public.pms_employee_salary_history (employee_id, effective_from desc);
create table if not exists public.pms_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  name text not null,
  relationship text,
  address text,
  contact text,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_dependents (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  name text not null,
  birth_date date,
  relationship text,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_educational_backgrounds (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  level text,
  school text,
  address text,
  school_year text,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_character_references (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  name text not null,
  occupation text,
  address text,
  contact text,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_employee_identifiers (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  identifier_type text not null,
  identifier_value text not null,
  created_at timestamptz not null default now(),
  unique (employee_id, identifier_type)
);
create table if not exists public.pms_payroll_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  payroll_frequency text not null check (payroll_frequency in ('monthly', 'semi_monthly', 'special')),
  work_days_per_period numeric(8,2) not null check (work_days_per_period > 0),
  hours_per_day numeric(8,2) not null check (hours_per_day > 0),
  overtime_multiplier numeric(8,4) not null check (overtime_multiplier >= 0),
  tardiness_deduction boolean not null default true,
  undertime_deduction boolean not null default true,
  rounding_mode text not null check (rounding_mode in ('component_reconcile', 'final_total', 'component_only')),
  effective_from date not null,
  effective_to date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_dates_valid check (effective_to is null or effective_to >= effective_from)
);
create table if not exists public.pms_loan_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  default_terms integer check (default_terms is null or default_terms > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pms_employee_loans (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  loan_type_id uuid not null references public.pms_loan_types(id) on delete restrict,
  loan_date date not null,
  principal_amount numeric(14,2) not null check (principal_amount > 0),
  repayment_terms integer not null check (repayment_terms > 0),
  installment_amount numeric(14,2) not null check (installment_amount > 0),
  outstanding_balance numeric(14,2) not null check (outstanding_balance >= 0),
  priority integer check (priority is null or priority > 0),
  status public.pms_loan_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pms_active_loan_priority_unique on public.pms_employee_loans(employee_id, priority) where status = 'active' and priority is not null;
create table if not exists public.pms_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  pay_date date not null,
  frequency text not null check (frequency in ('monthly', 'semi_monthly', 'special')),
  status public.pms_payroll_status not null default 'draft',
  finalized_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_period_dates_valid check (end_date >= start_date and pay_date >= end_date),
  exclude using gist (daterange(start_date, end_date, '[]') with &&) where (status <> 'cancelled')
);
create table if not exists public.pms_employee_attendance (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.pms_payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  days_worked numeric(8,2) not null default 0 check (days_worked >= 0),
  absence_days numeric(8,2) not null default 0 check (absence_days >= 0),
  tardiness_minutes numeric(10,2) not null default 0 check (tardiness_minutes >= 0),
  undertime_minutes numeric(10,2) not null default 0 check (undertime_minutes >= 0),
  overtime_hours numeric(10,2) not null default 0 check (overtime_hours >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id)
);
create table if not exists public.pms_other_income (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.pms_payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  transaction_type text not null,
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  status public.pms_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id, transaction_type, amount, description)
);
create table if not exists public.pms_other_deductions (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.pms_payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  transaction_type text not null,
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  status public.pms_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id, transaction_type, amount, description)
);
create table if not exists public.pms_statutory_rate_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_type text not null check (schedule_type in ('sss', 'philhealth', 'pagibig', 'withholding_tax')),
  calculation_type text not null check (calculation_type in ('percentage', 'fixed', 'bracket')),
  parameters jsonb not null default '{}'::jsonb,
  source_url text,
  source_reference text,
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint statutory_dates_valid check (effective_to is null or effective_to >= effective_from)
);
create table if not exists public.pms_payroll_records (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.pms_payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  salary_type public.pms_salary_type not null,
  basic_pay numeric(14,2) not null default 0,
  overtime_pay numeric(14,2) not null default 0,
  other_income numeric(14,2) not null default 0,
  gross_pay numeric(14,2) not null default 0,
  employee_contributions numeric(14,2) not null default 0,
  withholding_tax numeric(14,2) not null default 0,
  loan_deductions numeric(14,2) not null default 0,
  other_deductions numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  calculation_version text not null,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id)
);
create table if not exists public.pms_payroll_record_items (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid not null references public.pms_payroll_records(id) on delete restrict,
  item_type text not null check (item_type in ('earning', 'deduction', 'contribution', 'tax', 'loan')),
  code text not null,
  label text not null,
  amount numeric(14,2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_loan_repayments (
  id uuid primary key default gen_random_uuid(),
  employee_loan_id uuid not null references public.pms_employee_loans(id) on delete restrict,
  payroll_record_id uuid not null references public.pms_payroll_records(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  unique (employee_loan_id, payroll_record_id)
);
create table if not exists public.pms_employee_payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  payroll_record_id uuid not null unique references public.pms_payroll_records(id) on delete restrict,
  storage_path text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.pms_employees(id) on delete restrict,
  requested_changes jsonb not null,
  reason text,
  status public.pms_request_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_payroll_finalization_runs (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null unique references public.pms_payroll_periods(id) on delete restrict,
  idempotency_key text not null unique,
  finalized_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.pms_migration_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_snapshot text,
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  counts jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create or replace function public.pms_set_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
do $$
declare
  target_table text;
begin
  foreach target_table in array array['pms_profiles','pms_user_roles','pms_departments','pms_positions','pms_employees','pms_employee_assignments','pms_employee_salary_history','pms_payroll_policies','pms_loan_types','pms_employee_loans','pms_payroll_periods','pms_employee_attendance','pms_statutory_rate_schedules'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', target_table, target_table);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.pms_set_updated_at()', target_table, target_table);
  end loop;
end $$;
create or replace function public.pms_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pms_profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', '')) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists pms_on_auth_user_created on auth.users;
create trigger pms_on_auth_user_created after insert on auth.users for each row execute function public.pms_handle_new_user();
create or replace function public.pms_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pms_user_roles where user_id = auth.uid() and role = 'admin');
$$;
create or replace function public.pms_current_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.pms_employees where auth_user_id = auth.uid() limit 1;
$$;
create or replace function public.pms_write_audit_log(p_action text, p_entity_type text, p_entity_id uuid, p_before jsonb, p_after jsonb, p_metadata jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  result_id uuid;
begin
  insert into public.pms_audit_logs(actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, coalesce(p_metadata, '{}'::jsonb))
  returning id into result_id;
  return result_id;
end;
$$;
create or replace function public.pms_audit_sensitive_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.pms_write_audit_log('insert', tg_table_name, new.id, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.pms_write_audit_log('update', tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    perform public.pms_write_audit_log('delete', tg_table_name, old.id, to_jsonb(old), null);
    return old;
  end if;
end;
$$;
do $$
declare
  target_table text;
begin
  foreach target_table in array array['pms_payroll_periods','pms_payroll_records','pms_employee_loans','pms_loan_repayments','pms_employee_payslips','pms_profile_change_requests'] loop
    execute format('drop trigger if exists %I_audit on public.%I', target_table, target_table);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.pms_audit_sensitive_change()', target_table, target_table);
  end loop;
end $$;
create or replace function public.pms_prevent_finalized_payroll_mutation() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  payroll_state public.pms_payroll_status;
begin
  select status into payroll_state from public.pms_payroll_periods where id = coalesce(new.payroll_period_id, old.payroll_period_id);
  if payroll_state in ('finalized', 'paid') then
    raise exception 'Finalized payroll records are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists pms_payroll_records_immutable on public.pms_payroll_records;
create trigger pms_payroll_records_immutable before update or delete on public.pms_payroll_records for each row execute function public.pms_prevent_finalized_payroll_mutation();
create or replace function public.pms_review_profile_change_request(p_request_id uuid, p_status public.pms_request_status) returns void
language plpgsql security definer set search_path = public as $$
declare
  request_row public.pms_profile_change_requests;
  changes jsonb;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'Invalid review status'; end if;
  select * into request_row from public.pms_profile_change_requests where id = p_request_id for update;
  if request_row.id is null then raise exception 'Profile request not found'; end if;
  if request_row.status <> 'pending' then raise exception 'Profile request has already been reviewed'; end if;
  changes := request_row.requested_changes;
  if p_status = 'approved' then
    update public.pms_employees set
      email = case when changes ? 'email' then nullif(changes ->> 'email', '') else email end,
      contact_number = case when changes ? 'contact_number' then nullif(changes ->> 'contact_number', '') else contact_number end,
      permanent_address = case when changes ? 'permanent_address' then nullif(changes ->> 'permanent_address', '') else permanent_address end,
      present_address = case when changes ? 'present_address' then nullif(changes ->> 'present_address', '') else present_address end,
      religion = case when changes ? 'religion' then nullif(changes ->> 'religion', '') else religion end,
      civil_status = case when changes ? 'civil_status' then nullif(changes ->> 'civil_status', '') else civil_status end
    where id = request_row.employee_id;
  end if;
  update public.pms_profile_change_requests set status = p_status, reviewed_by = auth.uid(), reviewed_at = now() where id = p_request_id;
end;
$$;
create or replace function public.pms_calculate_schedule_amount(p_schedule_type text, p_base numeric, p_period_end date) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  schedule_row record;
  bracket_row jsonb;
  bracket_min numeric;
  bracket_max numeric;
  result numeric := 0;
  rate numeric;
begin
  for schedule_row in
    select * from public.pms_statutory_rate_schedules
    where schedule_type = p_schedule_type and status = 'approved'
      and effective_from <= p_period_end and (effective_to is null or effective_to >= p_period_end)
    order by effective_from desc
  loop
    if schedule_row.calculation_type = 'percentage' then
      rate := nullif(schedule_row.parameters ->> 'employee_rate', '')::numeric;
      result := p_base * coalesce(rate, 0);
    elsif schedule_row.calculation_type = 'fixed' then
      result := coalesce(nullif(schedule_row.parameters ->> 'employee_amount', '')::numeric, 0);
    else
      for bracket_row in select value from jsonb_array_elements(coalesce(schedule_row.parameters -> 'brackets', '[]'::jsonb)) loop
        bracket_min := coalesce(nullif(bracket_row ->> 'min', '')::numeric, 0);
        bracket_max := nullif(bracket_row ->> 'max', '')::numeric;
        if p_base >= bracket_min and (bracket_max is null or p_base <= bracket_max) then
          result := coalesce(nullif(bracket_row ->> 'base', '')::numeric, 0) + greatest(0, p_base - bracket_min) * coalesce(nullif(bracket_row ->> 'employee_rate', '')::numeric, 0) + coalesce(nullif(bracket_row ->> 'employee_amount', '')::numeric, 0);
          exit;
        end if;
      end loop;
    end if;
    exit;
  end loop;
  return round(coalesce(result, 0), 2);
end;
$$;
create or replace function public.pms_preview_payroll(p_payroll_period_id uuid)
returns table (
  id uuid,
  payroll_period_id uuid,
  employee_id uuid,
  salary_type public.pms_salary_type,
  basic_pay numeric,
  overtime_pay numeric,
  other_income numeric,
  gross_pay numeric,
  employee_contributions numeric,
  withholding_tax numeric,
  loan_deductions numeric,
  other_deductions numeric,
  total_deductions numeric,
  net_pay numeric,
  calculation_version text,
  calculation_snapshot jsonb,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  period_row public.pms_payroll_periods;
  policy_row public.pms_payroll_policies;
  employee_row public.pms_employees;
  salary_row public.pms_employee_salary_history;
  attendance_row public.pms_employee_attendance;
  basic numeric;
  hourly numeric;
  overtime numeric;
  income_total numeric;
  contribution_total numeric;
  tax_total numeric;
  loan_total numeric;
  deduction_total numeric;
  gross numeric;
  total numeric;
  net numeric;
  missing_schedules integer;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  select * into period_row from public.pms_payroll_periods where id = p_payroll_period_id;
  if period_row.id is null then raise exception 'Payroll period not found'; end if;
  if period_row.status in ('finalized', 'paid', 'cancelled') then raise exception 'This payroll period cannot be previewed'; end if;
  select * into policy_row from public.pms_payroll_policies where is_active = true and effective_from <= period_row.end_date and (effective_to is null or effective_to >= period_row.end_date) order by effective_from desc limit 1;
  if policy_row.id is null then raise exception 'No active payroll policy is configured for this period'; end if;
  select count(distinct schedule_type) into missing_schedules from public.pms_statutory_rate_schedules where status = 'approved' and effective_from <= period_row.end_date and (effective_to is null or effective_to >= period_row.end_date);
  if missing_schedules < 4 then raise exception 'All four approved statutory schedule types are required before payroll preview'; end if;

  for employee_row in select * from public.pms_employees where status = 'active' order by last_name, first_name loop
    select * into salary_row from public.pms_employee_salary_history where employee_id = employee_row.id and is_approved = true and effective_from <= period_row.end_date and (effective_to is null or effective_to >= period_row.start_date) order by effective_from desc limit 1;
    if salary_row.id is null then raise exception 'No effective salary configuration for employee %', employee_row.employee_number; end if;
    select * into attendance_row from public.pms_employee_attendance where employee_id = employee_row.id and payroll_period_id = p_payroll_period_id;
    if attendance_row.id is null then raise exception 'Missing attendance record for employee %', employee_row.employee_number; end if;
    if exists (select 1 from public.pms_employee_loans where employee_id = employee_row.id and status = 'active' and priority is null) then raise exception 'An active loan without administrator priority exists for employee %', employee_row.employee_number; end if;

     hourly := case when salary_row.salary_type = 'hourly' then salary_row.amount when salary_row.salary_type = 'daily' then salary_row.amount / policy_row.hours_per_day when salary_row.salary_type = 'monthly' then salary_row.amount / policy_row.work_days_per_period / policy_row.hours_per_day else 0 end;
     basic := case when salary_row.salary_type = 'monthly' then greatest(0, salary_row.amount - (attendance_row.absence_days * salary_row.amount / policy_row.work_days_per_period) - case when policy_row.tardiness_deduction then attendance_row.tardiness_minutes * hourly / 60 else 0 end - case when policy_row.undertime_deduction then attendance_row.undertime_minutes * hourly / 60 else 0 end) when salary_row.salary_type = 'daily' then salary_row.amount * attendance_row.days_worked else salary_row.amount * attendance_row.days_worked * policy_row.hours_per_day end;
    overtime := attendance_row.overtime_hours * hourly * policy_row.overtime_multiplier;
    select coalesce(sum(amount), 0) into income_total from public.pms_other_income where employee_id = employee_row.id and payroll_period_id = p_payroll_period_id and status = 'approved';
    select coalesce(sum(amount), 0) into deduction_total from public.pms_other_deductions where employee_id = employee_row.id and payroll_period_id = p_payroll_period_id and status = 'approved';
    select coalesce(sum(least(installment_amount, outstanding_balance)), 0) into loan_total from public.pms_employee_loans where employee_id = employee_row.id and status = 'active' and priority is not null;
    gross := round(basic + overtime + income_total, 2);
    contribution_total := public.pms_calculate_schedule_amount('sss', gross, period_row.end_date) + public.pms_calculate_schedule_amount('philhealth', gross, period_row.end_date) + public.pms_calculate_schedule_amount('pagibig', gross, period_row.end_date);
    tax_total := public.pms_calculate_schedule_amount('withholding_tax', gross, period_row.end_date);
    total := round(contribution_total, 2) + round(tax_total, 2) + round(loan_total, 2) + round(deduction_total, 2);
    net := round(gross - total, 2);
    if net < 0 then raise exception 'Net pay would be negative for employee %', employee_row.employee_number; end if;
     id := gen_random_uuid(); payroll_period_id := p_payroll_period_id; employee_id := employee_row.id; salary_type := salary_row.salary_type;
     basic_pay := round(basic, 2); overtime_pay := round(overtime, 2); other_income := round(income_total, 2); gross_pay := gross;
     employee_contributions := round(contribution_total, 2); withholding_tax := round(tax_total, 2); loan_deductions := round(loan_total, 2); other_deductions := round(deduction_total, 2); total_deductions := total; net_pay := net;
    calculation_version := 'payroll-v1-component-reconcile';
    calculation_snapshot := jsonb_build_object('policy_id', policy_row.id, 'salary_id', salary_row.id, 'attendance_id', attendance_row.id, 'period_id', period_row.id, 'statutory_period_end', period_row.end_date);
    created_at := now();
    return next;
  end loop;
end;
$$;
create or replace function public.pms_finalize_payroll(p_payroll_period_id uuid, p_idempotency_key text)
returns setof public.pms_payroll_records
language plpgsql security definer set search_path = public as $$
declare
  period_row public.pms_payroll_periods;
  run_row public.pms_payroll_finalization_runs;
  preview_row record;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  select * into period_row from public.pms_payroll_periods where id = p_payroll_period_id for update;
  if period_row.id is null then raise exception 'Payroll period not found'; end if;
  if period_row.status in ('paid', 'cancelled') then raise exception 'This payroll period cannot be finalized'; end if;
   select * into run_row from public.pms_payroll_finalization_runs where payroll_period_id = p_payroll_period_id;
   if run_row.id is not null then return query select * from public.pms_payroll_records where payroll_period_id = p_payroll_period_id order by employee_id; return; end if;
   if exists (select 1 from public.pms_payroll_finalization_runs where idempotency_key = p_idempotency_key) then raise exception 'The finalization key has already been used for another payroll period'; end if;
  update public.pms_payroll_periods set status = 'processing' where id = p_payroll_period_id;
  for preview_row in select * from public.pms_preview_payroll(p_payroll_period_id) loop
    insert into public.pms_payroll_records (id, payroll_period_id, employee_id, salary_type, basic_pay, overtime_pay, other_income, gross_pay, employee_contributions, withholding_tax, loan_deductions, other_deductions, total_deductions, net_pay, calculation_version, calculation_snapshot, created_at)
    values (preview_row.id, preview_row.payroll_period_id, preview_row.employee_id, preview_row.salary_type, preview_row.basic_pay, preview_row.overtime_pay, preview_row.other_income, preview_row.gross_pay, preview_row.employee_contributions, preview_row.withholding_tax, preview_row.loan_deductions, preview_row.other_deductions, preview_row.total_deductions, preview_row.net_pay, preview_row.calculation_version, preview_row.calculation_snapshot, preview_row.created_at);
    insert into public.pms_payroll_record_items (payroll_record_id, item_type, code, label, amount) values (preview_row.id, 'earning', 'BASIC_PAY', 'Basic pay', preview_row.basic_pay), (preview_row.id, 'earning', 'OVERTIME', 'Overtime pay', preview_row.overtime_pay), (preview_row.id, 'earning', 'OTHER_INCOME', 'Other income', preview_row.other_income), (preview_row.id, 'contribution', 'EMPLOYEE_CONTRIBUTIONS', 'Employee contributions', preview_row.employee_contributions), (preview_row.id, 'tax', 'WITHHOLDING_TAX', 'Withholding tax', preview_row.withholding_tax), (preview_row.id, 'loan', 'LOAN_DEDUCTIONS', 'Loan deductions', preview_row.loan_deductions), (preview_row.id, 'deduction', 'OTHER_DEDUCTIONS', 'Other deductions', preview_row.other_deductions);
    insert into public.pms_loan_repayments (employee_loan_id, payroll_record_id, amount)
      select loan.id, preview_row.id, least(loan.installment_amount, loan.outstanding_balance) from public.pms_employee_loans loan where loan.employee_id = preview_row.employee_id and loan.status = 'active' and loan.priority is not null and loan.outstanding_balance > 0;
    update public.pms_employee_loans loan set outstanding_balance = greatest(0, loan.outstanding_balance - least(loan.installment_amount, loan.outstanding_balance)), status = case when loan.outstanding_balance - least(loan.installment_amount, loan.outstanding_balance) <= 0 then 'completed' else 'active' end where loan.employee_id = preview_row.employee_id and loan.status = 'active' and loan.priority is not null and loan.outstanding_balance > 0;
  end loop;
   insert into public.pms_employee_payslips (employee_id, payroll_record_id)
    select employee_id, id from public.pms_payroll_records where payroll_period_id = p_payroll_period_id on conflict (payroll_record_id) do nothing;
  insert into public.pms_payroll_finalization_runs (payroll_period_id, idempotency_key, finalized_by) values (p_payroll_period_id, p_idempotency_key, auth.uid());
  update public.pms_payroll_periods set status = 'finalized', finalized_at = now() where id = p_payroll_period_id;
  return query select * from public.pms_payroll_records where payroll_period_id = p_payroll_period_id order by employee_id;
end;
$$;
create or replace function public.pms_publish_payslips(p_payroll_period_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  published_count integer;
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
   if not exists (select 1 from public.pms_payroll_periods where id = p_payroll_period_id and status in ('finalized', 'paid')) then raise exception 'Only finalized or paid payroll can publish payslips'; end if;
   update public.pms_employee_payslips set published_at = coalesce(published_at, now()) where payroll_record_id in (select id from public.pms_payroll_records where payroll_period_id = p_payroll_period_id);
  get diagnostics published_count = row_count;
  insert into public.pms_notifications (user_id, title, message, type)
    select employee.auth_user_id, 'Payslip published', 'Your payslip is ready to view.', 'payroll'
     from public.pms_employee_payslips slip join public.pms_employees employee on employee.id = slip.employee_id
    join public.pms_payroll_records record on record.id = slip.payroll_record_id
    where record.payroll_period_id = p_payroll_period_id and employee.auth_user_id is not null and slip.published_at is not null
      and not exists (select 1 from public.pms_notifications notification where notification.user_id = employee.auth_user_id and notification.type = 'payroll' and notification.message = 'Your payslip is ready to view.' and notification.created_at >= slip.published_at);
  return published_count;
end;
$$;
create or replace function public.pms_mark_payroll_paid(p_payroll_period_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.pms_is_admin() then raise exception 'Administrator access is required'; end if;
  update public.pms_payroll_periods set status = 'paid', paid_at = now() where id = p_payroll_period_id and status = 'finalized';
  if not found then raise exception 'Only finalized payroll can be marked paid'; end if;
end;
$$;
create or replace function public.pms_employee_has_payroll_period(p_period_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pms_payroll_records record
    join public.pms_employees employee on employee.id = record.employee_id
    join public.pms_payroll_periods period on period.id = record.payroll_period_id
    where record.payroll_period_id = p_period_id
      and employee.auth_user_id = auth.uid()
      and period.status in ('finalized', 'paid')
  );
$$;
create or replace function public.pms_is_published_payroll_period(p_period_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pms_payroll_periods where id = p_period_id and status in ('finalized', 'paid'));
$$;
alter table public.pms_profiles enable row level security;
alter table public.pms_user_roles enable row level security;
alter table public.pms_departments enable row level security;
alter table public.pms_positions enable row level security;
alter table public.pms_employees enable row level security;
alter table public.pms_employee_assignments enable row level security;
alter table public.pms_employee_salary_history enable row level security;
alter table public.pms_emergency_contacts enable row level security;
alter table public.pms_dependents enable row level security;
alter table public.pms_educational_backgrounds enable row level security;
alter table public.pms_character_references enable row level security;
alter table public.pms_employee_identifiers enable row level security;
alter table public.pms_payroll_policies enable row level security;
alter table public.pms_loan_types enable row level security;
alter table public.pms_employee_loans enable row level security;
alter table public.pms_payroll_periods enable row level security;
alter table public.pms_employee_attendance enable row level security;
alter table public.pms_other_income enable row level security;
alter table public.pms_other_deductions enable row level security;
alter table public.pms_statutory_rate_schedules enable row level security;
alter table public.pms_payroll_records enable row level security;
alter table public.pms_payroll_record_items enable row level security;
alter table public.pms_loan_repayments enable row level security;
alter table public.pms_employee_payslips enable row level security;
alter table public.pms_profile_change_requests enable row level security;
alter table public.pms_notifications enable row level security;
alter table public.pms_payroll_finalization_runs enable row level security;
alter table public.pms_audit_logs enable row level security;
alter table public.pms_migration_runs enable row level security;
create policy profiles_select_own on public.pms_profiles for select to authenticated using (id = auth.uid() or public.pms_is_admin());
create policy profiles_update_own on public.pms_profiles for update to authenticated using (id = auth.uid() or public.pms_is_admin()) with check (id = auth.uid() or public.pms_is_admin());
create policy user_roles_select_own_or_admin on public.pms_user_roles for select to authenticated using (user_id = auth.uid() or public.pms_is_admin());
create policy departments_read_authenticated on public.pms_departments for select to authenticated using (is_active or public.pms_is_admin());
create policy departments_admin_insert on public.pms_departments for insert to authenticated with check (public.pms_is_admin());
create policy departments_admin_update on public.pms_departments for update to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy positions_read_authenticated on public.pms_positions for select to authenticated using (is_active or public.pms_is_admin());
create policy positions_admin_insert on public.pms_positions for insert to authenticated with check (public.pms_is_admin());
create policy positions_admin_update on public.pms_positions for update to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy employees_read_own_or_admin on public.pms_employees for select to authenticated using (auth_user_id = auth.uid() or public.pms_is_admin());
create policy employees_admin_insert on public.pms_employees for insert to authenticated with check (public.pms_is_admin());
create policy employees_admin_update on public.pms_employees for update to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy assignments_read_own_or_admin on public.pms_employee_assignments for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy assignments_admin_write on public.pms_employee_assignments for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy salary_read_own_or_admin on public.pms_employee_salary_history for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy salary_admin_write on public.pms_employee_salary_history for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy emergency_read_own_or_admin on public.pms_emergency_contacts for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy emergency_admin_write on public.pms_emergency_contacts for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy dependents_read_own_or_admin on public.pms_dependents for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy dependents_admin_write on public.pms_dependents for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy education_read_own_or_admin on public.pms_educational_backgrounds for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy education_admin_write on public.pms_educational_backgrounds for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy references_read_own_or_admin on public.pms_character_references for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy references_admin_write on public.pms_character_references for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy identifiers_read_own_or_admin on public.pms_employee_identifiers for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy identifiers_admin_write on public.pms_employee_identifiers for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy policies_read_authenticated on public.pms_payroll_policies for select to authenticated using (is_active or public.pms_is_admin());
create policy policies_admin_write on public.pms_payroll_policies for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy loan_types_read_authenticated on public.pms_loan_types for select to authenticated using (is_active or public.pms_is_admin());
create policy loan_types_admin_write on public.pms_loan_types for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy loans_read_own_or_admin on public.pms_employee_loans for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy loans_admin_write on public.pms_employee_loans for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy periods_admin_read on public.pms_payroll_periods for select to authenticated using (public.pms_is_admin() or public.pms_employee_has_payroll_period(id));
create policy periods_admin_write on public.pms_payroll_periods for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy attendance_own_or_admin_read on public.pms_employee_attendance for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy attendance_admin_write on public.pms_employee_attendance for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy income_admin_all on public.pms_other_income for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy deductions_admin_all on public.pms_other_deductions for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy statutory_read_authenticated on public.pms_statutory_rate_schedules for select to authenticated using (status = 'approved' or public.pms_is_admin());
create policy statutory_admin_write on public.pms_statutory_rate_schedules for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy payroll_records_admin_or_published_employee on public.pms_payroll_records for select to authenticated using (public.pms_is_admin() or (employee_id = public.pms_current_employee_id() and public.pms_is_published_payroll_period(payroll_period_id)));
create policy payroll_records_admin_insert on public.pms_payroll_records for insert to authenticated with check (public.pms_is_admin());
create policy record_items_admin_or_own on public.pms_payroll_record_items for select to authenticated using (public.pms_is_admin() or exists (select 1 from public.pms_payroll_records record where record.id = payroll_record_id and record.employee_id = public.pms_current_employee_id()));
create policy record_items_admin_write on public.pms_payroll_record_items for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy repayments_admin_or_own on public.pms_loan_repayments for select to authenticated using (public.pms_is_admin() or exists (select 1 from public.pms_employee_loans loan where loan.id = employee_loan_id and loan.employee_id = public.pms_current_employee_id()));
create policy payslips_admin_or_own on public.pms_employee_payslips for select to authenticated using (public.pms_is_admin() or (employee_id = public.pms_current_employee_id() and published_at is not null));
create policy payslips_admin_write on public.pms_employee_payslips for all to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy profile_requests_own_select_insert on public.pms_profile_change_requests for select to authenticated using (employee_id = public.pms_current_employee_id() or public.pms_is_admin());
create policy profile_requests_own_insert on public.pms_profile_change_requests for insert to authenticated with check (employee_id = public.pms_current_employee_id());
create policy profile_requests_admin_update on public.pms_profile_change_requests for update to authenticated using (public.pms_is_admin()) with check (public.pms_is_admin());
create policy notifications_own_read_update on public.pms_notifications for select to authenticated using (user_id = auth.uid() or public.pms_is_admin());
create policy notifications_own_update on public.pms_notifications for update to authenticated using (user_id = auth.uid() or public.pms_is_admin()) with check (user_id = auth.uid() or public.pms_is_admin());
create policy notifications_admin_insert on public.pms_notifications for insert to authenticated with check (public.pms_is_admin());
create policy finalization_runs_admin_read on public.pms_payroll_finalization_runs for select to authenticated using (public.pms_is_admin());
create policy audit_admin_read on public.pms_audit_logs for select to authenticated using (public.pms_is_admin());
create policy migration_admin_read on public.pms_migration_runs for select to authenticated using (public.pms_is_admin());
insert into storage.buckets (id, name, public) values ('pms-employee-avatars', 'pms-employee-avatars', false), ('pms-payslips', 'pms-payslips', false) on conflict (id) do update set public = excluded.public;
create policy avatar_read_owner_or_admin on storage.objects for select to authenticated using (bucket_id = 'pms-employee-avatars' and (public.pms_is_admin() or (storage.foldername(name))[1] = public.pms_current_employee_id()::text));
create policy avatar_admin_write on storage.objects for all to authenticated using (bucket_id = 'pms-employee-avatars' and public.pms_is_admin()) with check (bucket_id = 'pms-employee-avatars' and public.pms_is_admin());
create policy payslip_read_owner_or_admin on storage.objects for select to authenticated using (bucket_id = 'pms-payslips' and (public.pms_is_admin() or exists (select 1 from public.pms_employee_payslips slip where slip.storage_path = name and slip.employee_id = public.pms_current_employee_id() and slip.published_at is not null)));
create policy payslip_admin_write on storage.objects for all to authenticated using (bucket_id = 'pms-payslips' and public.pms_is_admin()) with check (bucket_id = 'pms-payslips' and public.pms_is_admin());
