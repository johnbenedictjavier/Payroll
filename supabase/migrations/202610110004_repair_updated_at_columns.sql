-- Repair installations where PMS tables existed before the canonical updated_at columns.

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
  foreach target_table in array array[
    'pms_profiles',
    'pms_user_roles',
    'pms_departments',
    'pms_positions',
    'pms_employees',
    'pms_employee_assignments',
    'pms_employee_salary_history',
    'pms_payroll_policies',
    'pms_loan_types',
    'pms_employee_loans',
    'pms_payroll_periods',
    'pms_employee_attendance',
    'pms_statutory_rate_schedules'
  ] loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    execute format('alter table public.%I add column if not exists updated_at timestamptz', target_table);
    execute format('update public.%I set updated_at = now() where updated_at is null', target_table);
    execute format('alter table public.%I alter column updated_at set default now()', target_table);
    execute format('alter table public.%I alter column updated_at set not null', target_table);
    execute format('drop trigger if exists %I_updated_at on public.%I', target_table, target_table);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.pms_set_updated_at()', target_table, target_table);
  end loop;
end $$;
